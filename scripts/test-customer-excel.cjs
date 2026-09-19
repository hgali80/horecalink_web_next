/* eslint-disable @typescript-eslint/no-require-imports -- Node test harness matches existing project scripts. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const root = path.resolve(__dirname, "..");
const context = vm.createContext({ ExcelJS, Date });
for (const file of ["app/lib/customerExcelExport.js", "app/satissitok/services/commercialOfferService.js"]) {
  const source = fs.readFileSync(path.join(root, file), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "")
    .replace(/^export /gm, "");
  vm.runInContext(`(() => { ${source}; Object.assign(globalThis, {${file.includes("customerExcel") ? "buildCustomerWorkbook" : "calculateOfferTotals"}}); })()`, context);
}

// Evaluate only the arithmetic emitted by this exporter, independently of cached results.
function evaluate(sheet, address) {
  const cell = sheet.getCell(address);
  if (!cell.formula) return Number(cell.value);
  let expression = cell.formula.replace(/SUM\(H(\d+):H(\d+)\)/g, (_, first, last) => {
    let total = 0;
    for (let row = Number(first); row <= Number(last); row++) total += evaluate(sheet, `H${row}`);
    return String(total);
  });
  expression = expression.replace(/([A-I]\d+)/g, (_, ref) => String(evaluate(sheet, ref)))
    .replace(/^IF\(([^,]+),([^,]+),([^,]+)\)$/, "($1?$2:$3)");
  assert.match(expression, /^[\d.()+*/?:,>eE\s-]+$/);
  return Function(`"use strict"; return (${expression});`)();
}

async function main() {
  for (const lang of ["tr", "ru", "kz", "en"]) {
    const translations = JSON.parse(fs.readFileSync(path.join(root, `app/locales/${lang}.json`), "utf8"));
    const t = key => {
      const value = key.split(".").reduce((obj, part) => obj?.[part], translations);
      assert.equal(typeof value, "string", `Missing ${lang}: ${key}`);
      return value;
    };
    for (const rate of [0, 16, 12]) {
      const items = [
        { sku: "000123", name: "=1+1", description: "Ölçüler\n120 × 60 см", unit: "шт", quantity: "2.5", unitPrice: "1160.25", imageUrl: "https://example.com/product.jpg" },
        { sku: "002", name: "Кофе машинасы", quantity: 3, unitPrice: 0.01 },
        { sku: "003", name: "Free item", quantity: 0, unitPrice: 200 },
      ];
      const document = { title: "PRIVATE ADMIN TITLE", offerNo: "HL-001", issueDate: "2026-09-19", currency: "KZT", buyer: { companyName: "Müşteri", bin: "000456" }, items, visibility: { vatSummary: rate !== 12, termsSection: false, requisitesSection: false }, terms: { payment: ["PRIVATE TERMS"] }, seller: { bankDetails: "PRIVATE BANK" } };
      const calculated = context.calculateOfferTotals(items, rate);
      for (const offer of [false, true]) {
        const images = new Map([[items[0].imageUrl, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOZkAAAAASUVORK5CYII="]]);
        const original = context.buildCustomerWorkbook({ document, calculated: offer ? calculated : undefined, t, images });
        const book = new ExcelJS.Workbook();
        await book.xlsx.load(await original.xlsx.writeBuffer());
        const sheet = book.worksheets[0];
        assert.equal(sheet.model.merges.length, 0);
        assert.equal(sheet.pageSetup.paperSize, 9);
        assert.equal(sheet.pageSetup.fitToWidth, 1);
        assert.equal(sheet.views[0].state, "frozen");
        const first = Number(sheet.pageSetup.printTitlesRow.match(/\d+/)[0]) + 1;
        assert.equal(sheet.getCell(`A${first}`).value, "000123");
        assert.equal(sheet.getCell(`B${first}`).value, "=1+1");
        assert.equal(sheet.getCell(`B${first}`).type, ExcelJS.ValueType.String);
        assert.equal(sheet.getCell(`${offer ? "G" : "F"}${first}`).value, 1160.25);
        assert.match(sheet.getCell(`${offer ? "G" : "F"}${first}`).numFmt, /₸/);
        assert.equal(sheet.getImages().length, 1);
        const picture = sheet.getImages()[0];
        assert.equal(picture.range.tl.nativeRow, first - 1);
        assert.equal(picture.range.tl.nativeCol, offer ? 8 : 6);
        assert.equal(book.getImage(picture.imageId).extension, "png");
        assert.ok(book.getImage(picture.imageId).buffer.length > 0);
        assert.ok(sheet.getRow(first).height >= 84);
        assert.equal(sheet.getCell(`${offer ? "I" : "G"}${first + 1}`).value, t("customerExcel.imageUnavailable"));
        assert.ok(sheet.pageSetup.printTitlesRow);
        let totalRow;
        sheet.eachRow(row => {
          row.eachCell(cell => {
            assert.ok(!cell.text.includes("PRIVATE"));
            if (cell.formula) assert.ok(Math.abs(evaluate(sheet, cell.address) - (cell.result || 0)) < 1e-8);
          });
          if (row.getCell(3).value === t("customerExcel.grandTotal")) totalRow = row.number;
        });
        if (offer) {
          assert.ok(Math.abs(sheet.getCell(`H${totalRow}`).result - 2900.655) < 1e-8);
          assert.equal(sheet.getRow(totalRow + 1).hidden, rate === 12);
          assert.equal(sheet.getCell(`H${totalRow + 1}`).value, rate / 100);
          // Changing a quantity must change totals and VAT through cell references.
          sheet.getCell(`E${first}`).value = 5;
          assert.ok(Math.abs(evaluate(sheet, `H${totalRow}`) - 5801.28) < 1e-8);
          assert.ok(Math.abs(evaluate(sheet, `H${totalRow + 2}`) - (rate ? 5801.28 - 5801.28 / (1 + rate / 100) : 0)) < 1e-8);
        }
      }
    }
    const empty = context.buildCustomerWorkbook({ document: { items: [] }, calculated: context.calculateOfferTotals([], 16), t });
    empty.worksheets[0].eachRow(row => row.eachCell(cell => {
      if (cell.formula) assert.equal(evaluate(empty.worksheets[0], cell.address), 0);
    }));
  }
  console.log("PASS: XLSX round trips in four languages; numeric prices, literal SKUs/text, editable totals/VAT, zero/decimal quantities, empty offers, privacy, embedded images and print settings.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
