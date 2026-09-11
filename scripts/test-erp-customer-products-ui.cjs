// Real component, local fixtures only; no Firebase reads or writes.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const compiled = require("next/dist/compiled/webpack/webpack");
compiled.init();
const webpack = compiled.webpack;
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "customer-products-ui-"));
const write = (name, content) => fs.writeFileSync(path.join(temp, name), content);
write("loader.cjs", `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = source => ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;`);
write("link.jsx", "export default function Link({href,children,...props}) {return <a href={href} {...props}>{children}</a>;}");
write("entry.jsx", `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Products from ${JSON.stringify(path.join(root, "app/satissitok/admin/erp/_components/ErpCustomerProducts.jsx"))};
const sale=(id,quantity,price,extra={})=>({id,documentNo:id,documentKind:'sales',status:'confirmed',docType:'R',vatMode:'included',documentDate:'2026-09-10',dateLabel:'10.09.2026',sortTime:10,items:[{productId:'p1',productName:'Sıvı sabun 5 L',productSku:'SKU1',quantity,unit:'adet',unitPrice:price}],...extra});
const docs=[sale('S-1',10,1160),sale('S-2',20,1300,{vatMode:'excluded',documentDate:'2026-09-11',dateLabel:'11.09.2026',sortTime:11}),sale('F-1',2,700,{docType:'F'}),sale('OLD',3,900,{vatMode:'unknown'})];
createRoot(document.getElementById('root')).render(<div className="p-4"><Products documents={docs}/></div>);
`);
async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({mode:"development",devtool:false,context:root,entry:path.join(temp,"entry.jsx"),output:{path:temp,filename:"bundle.js"},
      resolve:{extensions:[".js",".jsx"],modules:[path.join(root,"node_modules")],alias:{"next/link$":path.join(temp,"link.jsx")}},
      module:{rules:[{test:/\.[jt]sx?$/,exclude:/node_modules/,use:path.join(temp,"loader.cjs")}]}});
    compiler.run((error,stats)=>compiler.close(()=>error || stats.hasErrors() ? reject(error || new Error(stats.toString({all:false,errors:true}))) : resolve()));
  });
  const cssDir = path.join(root,".next/static/css");
  const css = fs.readdirSync(cssDir).filter(file=>file.endsWith(".css")).map(file=>fs.readFileSync(path.join(cssDir,file),"utf8")).join("\n");
  const server = http.createServer((request,response)=>{
    if(request.url==="/bundle.js"){response.setHeader("Content-Type","application/javascript");response.end(fs.readFileSync(path.join(temp,"bundle.js")));}
    else {response.setHeader("Content-Type","text/html; charset=utf-8");response.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);}
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || "msedge"});
    const page = await browser.newPage({viewport:{width:1200,height:850}});
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("heading",{name:"Aldığı Ürünler"}).waitFor();
    assert.equal(await page.locator("tbody > tr").count(),3);
    assert.match(await page.locator("tbody > tr").first().innerText(),/30 adet[\s\S]*1.392,00 KZT[\s\S]*1.508,00 KZT/);
    await page.locator("summary").first().click();
    assert.equal(await page.getByRole("link",{name:"S-2",exact:true}).getAttribute("href"),"/satissitok/admin/erp/sales/S-2");
    await page.screenshot({path:path.join(temp,"desktop.png"),fullPage:true});
    await page.getByLabel("Resmî satış fiyatları").selectOption("excluded");
    assert.match(await page.locator("tbody > tr").first().innerText(),/1.200,00 KZT[\s\S]*1.300,00 KZT/);
    await page.getByLabel("Başlangıç").fill("2026-09-11");
    assert.equal(await page.locator("tbody > tr").count(),1);
    assert.match(await page.locator("tbody > tr").innerText(),/20 adet/);
    await page.getByLabel("Ürün / SKU").fill("missing");
    await page.getByText("Bu filtrelere uygun onaylanmış ürün satışı yok.").waitFor();
    await page.getByLabel("Ürün / SKU").fill("SKU1");
    await page.getByLabel("Başlangıç").fill("");
    await page.getByLabel("Belge tipi").selectOption("F");
    assert.equal(await page.locator("tbody > tr").count(),1);
    assert.match(await page.locator("tbody > tr").innerText(),/700,00 KZT/);
    await page.getByLabel("Belge tipi").selectOption("");
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(temp,"mobile.png"),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"Table scrolls inside card on mobile");
    assert.deepEqual(errors,[]);
    console.log(`PASS: customer history rendering, VAT/date/search/type filters, document links, mobile containment. Screenshots: ${temp}`);
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
