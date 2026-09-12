// Bundles the real Finance page with local fixtures; no Firebase access.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const compiled = require("next/dist/compiled/webpack/webpack");
compiled.init();
const webpack = compiled.webpack;
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "cash-cancel-ui-"));
const write = (name, contents) => fs.writeFileSync(path.join(temp, name), contents);
write("loader.cjs", `const ts=require(${JSON.stringify(require.resolve("typescript"))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
write("services.jsx", `
const common={currency:'KZT',cariName:'PEŞİN SATIŞ',accountId:'bank',accountName:'Nakit Kasa',dateLabel:'11.09.2026',sortTime:100,status:'posted'};
let rows=[{...common,id:'in',kind:'manual',direction:'in',amount:189999,receiptNo:'TH-26-00016',advanceFromCancellation:true,originalDocumentNo:'SB-F-26-0007'},{...common,id:'out',kind:'document_settlement',direction:'out',amount:5000,receiptNo:'TH-26-00020',documentId:'purchase',documentNo:'PB-R-26-0001'}];
let balance=184999;
export async function listErpCashAccounts(){return [{id:'bank',name:'Nakit Kasa',type:'cash',currency:'KZT',active:true,openingBalance:0,currentBalance:balance}];}
export async function listErpCashMovements(){return rows;}
export async function cancelErpCashMovement(args){window.__calls=[...(window.__calls||[]),args];await new Promise(resolve=>setTimeout(resolve,120));if(window.__fail)throw new Error('Test kayıtları uyuşmuyor');const row=rows.find(row=>row.id===args.movementId);balance+=row.direction==='in'?-row.amount:row.amount;rows=rows.map(row=>row.id===args.movementId?{...row,status:'cancelled',cancellationReason:args.reason,cancelledByName:'Test Admin',cancelledDateLabel:'12.09.2026'}:row);}
export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>;}
`);
write("entry.jsx", `import React from 'react';import {createRoot} from 'react-dom/client';import Finance from ${JSON.stringify(path.join(root,"app/satissitok/admin/erp/finance/page.jsx"))};createRoot(document.getElementById('root')).render(<div className="p-4"><Finance/></div>);`);
async function main() {
  await new Promise((resolve,reject)=>{
    const compiler=webpack({mode:"development",devtool:false,context:root,entry:path.join(temp,"entry.jsx"),output:{path:temp,filename:"bundle.js"},resolve:{extensions:[".js",".jsx"],modules:[path.join(root,"node_modules")],alias:{"next/link$":path.join(temp,"services.jsx")}},module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,"loader.cjs")}]},plugins:[new webpack.NormalModuleReplacementPlugin(/erp(FinanceService|CashMovementCancellation)$/,path.join(temp,"services.jsx"))]});
    compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error||new Error(stats.toString({all:false,errors:true}))):resolve()));
  });
  const cssDir=path.join(root,".next/static/css");
  const css=fs.existsSync(cssDir)?fs.readdirSync(cssDir).filter(name=>name.endsWith(".css")).map(name=>fs.readFileSync(path.join(cssDir,name),"utf8")).join("\n"):"";
  const server=http.createServer((req,res)=>{if(req.url==="/bundle.js"){res.setHeader("Content-Type","application/javascript");res.end(fs.readFileSync(path.join(temp,"bundle.js")));}else{res.setHeader("Content-Type","text/html; charset=utf-8");res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);}});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true,channel:"msedge"});
    const page=await browser.newPage({viewport:{width:1200,height:900}});
    const errors=[];page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("button",{name:"Tahsilatı iptal et",exact:true}).click();
    assert.equal(await page.getByRole("button",{name:"İptali onayla"}).isDisabled(),true);
    await page.getByRole("button",{name:"Vazgeç"}).click();
    assert.equal(await page.evaluate(()=>window.__calls?.length||0),0);
    await page.getByRole("button",{name:"Tahsilatı iptal et",exact:true}).click();
    await page.getByRole("dialog").getByLabel("İptal gerekçesi").fill("Mükerrer tahsilat");
    await page.screenshot({path:path.join(temp,"desktop-dialog.png"),fullPage:true});
    await page.evaluate(()=>{window.__fail=true;});
    await page.getByRole("button",{name:"İptali onayla"}).click();
    await page.getByRole("alert").waitFor();
    await page.evaluate(()=>{window.__fail=false;});
    await page.getByRole("button",{name:"İptali onayla"}).dblclick();
    await page.getByText("İptal edildi",{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.__calls.length),2,"One failed attempt and one successful attempt");
    assert.match(await page.getByText("Filtrelenen giriş",{exact:true}).locator("..").innerText(),/0,00 KZT/);
    assert.match(await page.getByText("Filtrelenen çıkış",{exact:true}).locator("..").innerText(),/5.000,00 KZT/);
    await page.getByRole("combobox",{name:"Durum",exact:true}).selectOption("cancelled");
    assert.equal(await page.locator("tbody tr").count(),1);
    assert.match(await page.locator("tbody").innerText(),/Mükerrer tahsilat/);
    await page.getByRole("combobox",{name:"Durum",exact:true}).selectOption("active");
    await page.getByRole("button",{name:"Ödemeyi iptal et",exact:true}).click();
    await page.getByText("Faturanın kalan tutarı artırılır ve ödeme durumu yeniden açılır.",{exact:true}).waitFor();
    await page.getByRole("dialog").getByLabel("İptal gerekçesi").fill("Yanlış ödeme kaydı");
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(temp,"mobile-dialog.png"),fullPage:true});
    const bounds=await page.getByRole("dialog").boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390,"Mobile dialog fits screen");
    await page.getByRole("button",{name:"İptali onayla"}).click();
    await page.getByText("Bu filtrelere uygun hareket bulunamadı. Filtreleri temizleyebilir veya eski kayıtları yükleyebilirsin.").waitFor();
    assert.match(await page.getByText("Güncel toplam bakiye",{exact:true}).locator("..").innerText(),/0,00 KZT/);
    await page.getByRole("combobox",{name:"Durum",exact:true}).selectOption("");
    assert.equal(await page.getByText("İptal edildi",{exact:true}).count(),2);
    assert.deepEqual(errors,[]);
    console.log(`PASS: real Finance page incoming/outgoing cancellations, required reason, dismiss/retry/double submit, status filters, excluded totals, refreshed balances, mobile dialog. Screenshots: ${temp}`);
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

