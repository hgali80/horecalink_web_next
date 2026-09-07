// Run with Playwright available (NODE_PATH may point at the bundled runtime).
// Bundles the real component with local service fixtures; never contacts Firebase.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const compiledWebpack = require("next/dist/compiled/webpack/webpack");
compiledWebpack.init();
const webpack = compiledWebpack.webpack;
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "offer-sale-ui-"));
const write = (name, value) => fs.writeFileSync(path.join(temp, name), value);
write("loader.cjs", `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText; };`);
write("services.js", `
export async function listErpCaris() { return [{id:'erp-1', name:'ERP Test Müşterisi', code:'CAR000001', bin:'123456789012', isActive:true}]; }
export async function getErpSettings() { return {warehouses:[],salesPlatforms:[]}; }
export async function convertCommercialOfferToSale(args) {
 window.__calls = [...(window.__calls || []), args];
 await new Promise(resolve => setTimeout(resolve, 80));
 if(window.__fail) throw new Error('Test bağlantı hatası');
 return {id:'sale-1'};
}
export function useRouter() { return {push: value => {window.__destination=value;}}; }
export default function Link({href,children,...props}) { return <a href={href} {...props}>{children}</a>; }
`);
write("entry.jsx", `
import React from 'react';
import {createRoot} from 'react-dom/client';
import Transfer from ${JSON.stringify(path.join(root, "app/satissitok/admin/commercial-offers/OfferSaleTransfer.jsx"))};
const mode=new URLSearchParams(location.search).get('mode');
const offer={offerNo:'HL-19', buyer:{companyName:'TOO Edu Trade',bin:'123456789012',phone:'+777470180903'},items:[{name:'Özel üretim',quantity:2,unitPrice:1160}],salesDocumentId:mode==='linked'?'sale-existing':null};
createRoot(document.getElementById('root')).render(<div style={{padding:24}}><Transfer offerId={mode==='unsaved'?null:'offer-1'} offer={offer}/></div>);
`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: "development", devtool: false, context: root, entry: path.join(temp, "entry.jsx"),
      output: { path: temp, filename: "bundle.js" },
      resolve: { extensions: [".js", ".jsx"], modules: [path.join(root, "node_modules")], alias: { "next/navigation$": path.join(temp, "services.js"), "next/link$": path.join(temp, "services.js") } },
      module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temp, "loader.cjs") }] },
      plugins: [new webpack.NormalModuleReplacementPlugin(/erp(Car(is|i)|Settings|DocumentMutation)Service$/, path.join(temp, "services.js"))],
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const cssDir = path.join(root, ".next/static/css");
  const css = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter(name => name.endsWith(".css")).map(name => fs.readFileSync(path.join(cssDir, name), "utf8")).join("\n") : "";
  const server = http.createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("Content-Type", "application/javascript"); response.end(fs.readFileSync(path.join(temp, "bundle.js"))); }
    else { response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(`<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await page.goto(baseUrl);
    await page.getByRole("button", { name: "Satış Faturasına Aktar", exact: true }).click();
    await page.getByRole("combobox", { name: /^ERP carisi/ }).selectOption("erp-1");
    assert.equal(await page.getByRole("radio", { checked: true }).count(), 0, "No document type preselected");
    assert.equal(await page.getByRole("button", { name: "Satış Taslağını Aç" }).isDisabled(), true);
    await page.getByRole("radio", { name: "Resmî (R)", exact: true }).check();
    await page.screenshot({ path: path.join(temp, "desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Satış Taslağını Aç" }).dblclick();
    await page.waitForFunction(() => window.__destination);
    assert.equal(await page.evaluate(() => window.__calls.length), 1, "Double click submits once");
    assert.equal(await page.evaluate(() => window.__calls[0].docType), "R");
    assert.equal(await page.evaluate(() => window.__destination), "/satissitok/admin/erp/sales/sale-1");

    await page.goto(baseUrl);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Satış Faturasına Aktar", exact: true }).click();
    await page.getByRole("radio", { name: "Fiilî (F)", exact: true }).check();
    await page.getByRole("combobox", { name: /^Cari işlemi/ }).selectOption("new");
    assert.equal(await page.getByLabel("Firma / müşteri adı", { exact: true }).inputValue(), "TOO Edu Trade");
    await page.screenshot({ path: path.join(temp, "mobile.png"), fullPage: true });
    const bounds = await page.getByRole("dialog").boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, "Dialog fits mobile width");
    await page.evaluate(() => { window.__fail = true; });
    await page.getByRole("button", { name: "Satış Taslağını Aç" }).click();
    await page.getByRole("alert").waitFor();
    assert.match(await page.getByRole("alert").innerText(), /bağlantı hatası/);
    await page.evaluate(() => { window.__fail = false; });
    await page.getByRole("button", { name: "Satış Taslağını Aç" }).click();
    await page.waitForFunction(() => window.__destination);
    assert.equal(await page.evaluate(() => window.__calls[1].newCari.name), "TOO Edu Trade");
    assert.equal(await page.evaluate(() => window.__calls[1].docType), "F");

    await page.goto(baseUrl + "?mode=linked");
    assert.equal(await page.getByRole("link", { name: "Bağlı Satış Faturasını Aç" }).getAttribute("href"), "/satissitok/admin/erp/sales/sale-existing");
    await page.goto(baseUrl + "?mode=unsaved");
    assert.equal(await page.getByRole("button", { name: "Satış Faturasına Aktar", exact: true }).isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile dialog, explicit R/F choice, cari prefilling, double click, retry, linked invoice and unsaved offer");
    console.log(`UI screenshots: ${temp}`);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
