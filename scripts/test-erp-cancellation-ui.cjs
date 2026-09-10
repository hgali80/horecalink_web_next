// Local browser fixture for the real cancellation component. No Firebase access.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const compiledWebpack = require("next/dist/compiled/webpack/webpack");
compiledWebpack.init();
const webpack = compiledWebpack.webpack;
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "erp-cancel-ui-"));
const write = (name, contents) => fs.writeFileSync(path.join(temp, name), contents);
write("loader.cjs", `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = source => ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
write("services.js", `
export async function cancelErpDocument(args) {
  window.__calls = [...(window.__calls || []),args];
  await new Promise(resolve=>setTimeout(resolve,100));
  if(window.__fail) throw new Error('Test stok geçmişi uyuşmuyor');
  return {retainedAdvanceAmount:40,recalculatedSalesCount:2,cancelledByName:'Test Admin'};
}
export function formatErpDate(value) {return new Date(value).toLocaleDateString('tr-TR');}
`);
write("entry.jsx", `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Cancellation from ${JSON.stringify(path.join(root, "app/satissitok/admin/erp/_components/ErpDocumentCancellation.jsx"))};
function App(){const params=new URLSearchParams(location.search); const [record,setRecord]=useState({id:'invoice-1',status:params.get('status')||'confirmed',invoiceNo:'INV-100',cariName:'Test Cari'});
return <div style={{padding:24}}><Cancellation kind={params.get('kind')||'sales'} record={record} onCancelled={setRecord}/></div>;}
createRoot(document.getElementById('root')).render(<App/>);
`);
async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, context: root, entry: path.join(temp,"entry.jsx"), output:{path:temp,filename:"bundle.js"},
      resolve:{extensions:[".js",".jsx"],modules:[path.join(root,"node_modules")]},
      module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,"loader.cjs")}]},
      plugins:[new webpack.NormalModuleReplacementPlugin(/erpDocument(Cancellation|s)Service$/,path.join(temp,"services.js"))],
    });
    compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
  });
  const cssDir=path.join(root,".next/static/css");
  const css=fs.existsSync(cssDir)?fs.readdirSync(cssDir).filter(name=>name.endsWith(".css")).map(name=>fs.readFileSync(path.join(cssDir,name),"utf8")).join("\n"):"";
  const server=http.createServer((req,res)=>{
    if(req.url==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(fs.readFileSync(path.join(temp,"bundle.js")));}
    else {res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const page=await browser.newPage({viewport:{width:1100,height:900}});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    const url=`http://127.0.0.1:${server.address().port}`;
    for(const kind of ["sales","purchases"]){
      await page.goto(`${url}?kind=${kind}`);
      await page.getByRole("button",{name:"Faturayı iptal et",exact:true}).click();
      assert.equal(await page.getByRole("button",{name:"İptali onayla"}).isDisabled(),true);
      await page.getByRole("button",{name:"Vazgeç"}).click();
      assert.equal(await page.evaluate(()=>window.__calls?.length||0),0);
      await page.getByRole("button",{name:"Faturayı iptal et",exact:true}).click();
      await page.getByLabel("İptal gerekçesi").fill("Hatalı ürün miktarı");
      await page.setViewportSize({width:390,height:844});
      await page.screenshot({path:path.join(temp,`${kind}-mobile.png`),fullPage:true});
      const bounds=await page.getByRole("dialog").boundingBox();
      assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390,"Dialog fits mobile");
      await page.evaluate(()=>{window.__fail=true;});
      await page.getByRole("button",{name:"İptali onayla"}).click();
      await page.getByRole("alert").waitFor();
      assert.match(await page.getByRole("alert").innerText(),/uyuşmuyor/);
      await page.evaluate(()=>{window.__fail=false;});
      await page.getByRole("button",{name:"İptali onayla"}).click();
      await page.getByRole("status").waitFor();
      assert.match(await page.getByRole("status").innerText(),/İptal edildi/);
      assert.match(await page.getByRole("status").innerText(),/40 KZT/);
      assert.match(await page.getByRole("status").innerText(),/Hatalı ürün miktarı/);
      assert.equal(await page.getByRole("button",{name:"Faturayı iptal et",exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>window.__calls[1].kind),kind);
      await page.screenshot({path:path.join(temp,`${kind}-cancelled.png`),fullPage:true});
    }
    await page.goto(`${url}?status=draft`);
    assert.equal(await page.getByRole("button",{name:"Faturayı iptal et",exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log(`PASS: sales/purchase dialogs, required reason, dismiss, error/retry, cancelled audit and advance, mobile layout. Screenshots: ${temp}`);
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
