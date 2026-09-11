const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const ctx = vm.createContext({});
for (const [file, names] of [
  ["erpCustomerProductHistory.js", ["buildCustomerProductHistory"]],
  ["erpPriceMemoryService.js", ["resolveErpSalesPriceHints", "refreshAutomaticSalesPrices"]],
]) {
  const source = fs.readFileSync(path.join(__dirname, "../app/satissitok/admin/erp/_services", file), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "").replace(/^export /gm, "");
  vm.runInContext(`(() => { ${source}; Object.assign(globalThis, {${names.join(",")}}); })()`, ctx);
}
const sale = (id, quantity, price, overrides = {}) => ({
  id, cariId: "c1", documentKind: "sales", status: "confirmed", docType: "R", vatMode: "included",
  documentDate: "2026-09-10", dateLabel: "10.09.2026", sortTime: 10,
  items: [{ productId: "p1", productName: "Sabun", productSku: "SKU1", unit: "adet", quantity, unitPrice: price }], ...overrides,
});
const older = sale("old", 10, 1160);
const newer = sale("new", 20, 1300, { vatMode: "excluded", documentDate: "2026-09-11", dateLabel: "11.09.2026", sortTime: 11 });
const docs = [older, newer, sale("draft", 500, 50, { status: "draft" }), sale("cancelled", 500, 50, { status: "cancelled" }), sale("purchase", 500, 50, { documentKind: "purchases" })];
const [net] = ctx.buildCustomerProductHistory(docs, { vatMode: "excluded" });
assert.equal(net.quantity, 30);
assert.equal(net.averagePrice, 1200);
assert.equal(net.lastPrice, 1300);
assert.equal(net.lastDate, "11.09.2026");
assert.equal(net.history.length, 2);
const [gross] = ctx.buildCustomerProductHistory(docs);
assert.equal(gross.averagePrice, 1392);
assert.equal(gross.lastPrice, 1508);
assert.equal(ctx.buildCustomerProductHistory(docs, { from: "2026-09-11" })[0].quantity, 20);
assert.equal(ctx.buildCustomerProductHistory(docs, { to: "2026-09-10" })[0].quantity, 10);
assert.equal(ctx.buildCustomerProductHistory(docs, { query: "sku1" }).length, 1);
assert.equal(ctx.buildCustomerProductHistory(docs, { query: "missing" }).length, 0);
const separate = ctx.buildCustomerProductHistory([older, sale("f", 2, 500, { docType: "F" }), sale("legacy", 3, 700, { vatMode: undefined }), sale("unit", 2, 50, { items: [{ ...older.items[0], unit: "koli" }] })]);
assert.equal(separate.length, 4);
assert.equal(separate.find(row => row.basis === "R-unknown").lastPrice, 700);
assert.equal(separate.find(row => row.basis === "F").lastPrice, 500);
assert.equal(ctx.buildCustomerProductHistory([sale("zero", 0, 900)]).length, 0);
assert.equal(ctx.buildCustomerProductHistory([sale("same-day-old", 1, 100, { confirmationSortTime: 1 }), sale("same-day-new", 1, 200, { confirmationSortTime: 2 })])[0].lastPrice, 200);

const c2 = sale("c2-sale", 1, 2320, { cariId: "c2" });
const memory = [c2, newer, older];
const automatic = { productId: "p1", unitPrice: 50, automaticSalesPrice: true, defaultSalesPrice: 60 };
const manual = { ...automatic, automaticSalesPrice: false, unitPrice: 777 };
const saved = { productId: "p1", unitPrice: 888 };
const context = { cariId: "c1", docType: "R", vatMode: "included" };
const refresh = (items, overrides) => ctx.refreshAutomaticSalesPrices(items, memory, { ...context, ...overrides });
assert.equal(refresh([automatic])[0].unitPrice, 1508, "Customer history wins over other customers");
assert.equal(refresh([automatic], { cariId: "c2" })[0].unitPrice, 2320);
assert.equal(refresh([automatic], { vatMode: "excluded" })[0].unitPrice, 1300);
assert.equal(refresh([manual], { cariId: "c2" })[0].unitPrice, 777, "Manual override survives customer change");
assert.equal(refresh([saved])[0].unitPrice, 888, "Reopened saved prices are retained");
assert.equal(ctx.refreshAutomaticSalesPrices([automatic], [], context)[0].unitPrice, 60);
assert.equal(ctx.refreshAutomaticSalesPrices([automatic], [sale("free", 1, 0)], context)[0].unitPrice, 0);
console.log("PASS: weighted averages, latest price, date/search filters, R/F/legacy/unit separation, confirmed sales only; customer price autofill, VAT conversion, manual and saved-price preservation");
