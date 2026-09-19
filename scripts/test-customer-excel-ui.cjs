/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node browser test. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const ExcelJS = require("exceljs");
const compiledWebpack = require("next/dist/compiled/webpack/webpack");
compiledWebpack.init();
const webpack = compiledWebpack.webpack;
const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "customer-excel-ui-"));
const write = (name, value) => fs.writeFileSync(path.join(temp, name), value);
write("loader.cjs", `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText; };`);
write("entry.jsx", `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CustomerExcelButton from '@/app/components/CustomerExcelButton';
import { LanguageProvider } from '@/app/context/LanguageContext';
function App() {
 const [error,setError]=useState('');
 const mode = new URLSearchParams(location.search).get('mode');
 const items = mode === 'empty' ? [] : [{sku:'00001',name:'Кофе makinesi',unit:'шт',quantity:2,unitPrice:1160,lineTotal:2320}];
 const document={offerNo:mode==='offer'?'HL-001':undefined,items,currency:'KZT'};
 const calculated=mode==='offer'?{items,totals:{grandTotal:2320,vatRate:16,vatAmount:320}}:mode==='error'?{items:null}:undefined;
 return <><CustomerExcelButton document={document} calculated={calculated} onError={setError}/><p role="status">{error}</p></>;
}
createRoot(document.getElementById('root')).render(<LanguageProvider><App/></LanguageProvider>);
`);

async function main() {
  await new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: "development", devtool: false, context: root, entry: path.join(temp, "entry.jsx"),
      output: { path: temp, filename: "bundle.js", publicPath: "/" },
      resolve: { extensions: [".js", ".jsx", ".ts", ".tsx"], modules: [path.join(root, "node_modules")], alias: { "@": root } },
      module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(temp, "loader.cjs") }] },
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const server = http.createServer((request, response) => {
    const name = path.basename(request.url.split("?")[0]);
    if (name.endsWith(".js") && fs.existsSync(path.join(temp, name))) {
      response.setHeader("Content-Type", "application/javascript");
      response.end(fs.readFileSync(path.join(temp, name)));
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "msedge" });
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const lang of ["tr", "ru", "kz", "en"]) {
      const labels = JSON.parse(fs.readFileSync(path.join(root, `app/locales/${lang}.json`), "utf8")).customerExcel;
      await page.addInitScript(value => localStorage.setItem("hl_lang", value), lang);
      for (const mode of ["presentation", "offer", "empty", "error"]) {
        await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
        const button = page.getByRole("button", { name: labels.download, exact: true });
        await button.waitFor();
        if (mode === "empty") { assert.ok(await button.isDisabled()); continue; }
        if (mode === "error") {
          await button.click();
          await page.getByRole("status").filter({ hasText: labels.error }).waitFor();
          assert.ok(await button.isEnabled());
          continue;
        }
        const pending = page.waitForEvent("download");
        await button.click();
        const download = await pending;
        assert.equal(download.suggestedFilename(), mode === "offer" ? "HL-001.xlsx" : "HorecaLink.xlsx");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(await download.path());
        const sheet = workbook.worksheets[0];
        assert.equal(sheet.name, labels[mode]);
        assert.equal(sheet.model.merges.length, 0);
        const row = Number(sheet.pageSetup.printTitlesRow.match(/\d+/)[0]) + 1;
        assert.equal(sheet.getCell(`A${row}`).value, "00001");
        if (mode === "offer") assert.equal(sheet.getCell(`H${row}`).result, 2320);
        await button.waitFor();
        assert.ok(await button.isEnabled());
      }
    }
    assert.deepEqual(errors, []);
    console.log("PASS: real browser downloads for both document types in four languages, empty-state disabling, error handling and retry availability.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
