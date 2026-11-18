const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const ctx = vm.createContext({});
for (const [file, names] of [["erpPriceMemoryService.js", ["resolveErpSalesPriceHints", "resolveErpPurchasePriceHints"]], ["erpVat.js", ["calculateErpVatLine", "summarizeErpVat"]], ["erpDocumentMutationService.js", ["normalizePayload"]], ["erpReportVat.js", ["buildReportVat"]], ["erpCustomerProductHistory.js", ["buildCustomerProductHistory"]]]) {
  const source = fs.readFileSync(path.join(__dirname, "../app/satissitok/admin/erp/_services", file), "utf8").replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "").replace(/^export /gm, "");
  vm.runInContext(`(() => { ${source}; Object.assign(globalThis, {${names.join(",")}}); })()`, ctx);
}
for (const kind of ["sales", "purchases"]) {
  for (const mode of ["included", "excluded", "unknown"]) {
    for (const docType of ["R", "F"]) {
      const taxed = docType === "R" && mode !== "unknown";
      const price = mode === "excluded" ? 100 : 116;
      const data = ctx.normalizePayload(kind, { docType, vatMode: mode, items: [{ productName: "Test", quantity: 2, unitPrice: price }], additionalCostTotal: 10, instantPaymentEnabled: true, paidAmount: 50 });
      const expectedNet = taxed ? 200 : price * 2;
      const expectedVat = taxed ? 32 : 0;
      assert.equal(data.vatSummary.netTotal, expectedNet);
      assert.equal(data.vatSummary.vatTotal, expectedVat);
      assert.equal(data.totalAmount, expectedNet + expectedVat + (kind === "purchases" ? 10 : 0));
      assert.equal(data.settlementSummary.outstandingAmount, data.totalAmount - 50);
      assert.equal(data.items[0].effectiveLineCost, expectedNet + 10);
      const reopened = ctx.normalizePayload(kind, JSON.parse(JSON.stringify(data)));
      assert.equal(reopened.totalAmount, data.totalAmount);
      assert.equal(reopened.vatSummary.vatTotal, expectedVat);
    }
  }
}
const tiny = ctx.calculateErpVatLine(3, 0.01, "R", "included");
assert.equal(tiny.netTotal + tiny.vatTotal, tiny.grossTotal);
assert.equal(ctx.calculateErpVatLine(0, 116, "R", "included").vatTotal, 0);
const legacy = ctx.normalizePayload("sales", {docType: "R", items: [{productName:"Old", quantity: 1, unitPrice: 116}]});
assert.equal(legacy.totalAmount, 116);
assert.equal(legacy.vatMode, "unknown");
console.log("PASS: sales/purchases VAT included/excluded, R/F, legacy, rounding, costs, settlements and serialization");

for (const resolve of [ctx.resolveErpSalesPriceHints, ctx.resolveErpPurchasePriceHints]) {
  const result = resolve({ rows: [{ docType: "R", vatMode: "excluded", items: [{ productId: "p", unitPrice: 100 }] }], productId: "p", docType: "R", vatMode: "included" });
  assert.equal((result.lastSale || result.lastPurchase).value, 116);
}
console.log("PASS: price history VAT mode conversion");

const mixedItems = [
  { productId: "a", productName: "A", quantity: 2, unitPrice: 116, vatMode: "included" },
  { productId: "b", productName: "B", quantity: 1, unitPrice: 200, vatMode: "excluded" },
];
for (const kind of ["sales", "purchases"]) {
  const mixed = ctx.normalizePayload(kind, { docType: "R", items: mixedItems, additionalCostTotal: 10 });
  assert.equal(mixed.vatMode, "mixed");
  assert.deepEqual(JSON.parse(JSON.stringify(mixed.vatSummary)), { netTotal: 400, vatTotal: 64, grossTotal: 464 });
  assert.equal(mixed.totalAmount, kind === "purchases" ? 474 : 464);
  assert.equal(mixed.items[0].effectiveLineCost, 205);
  assert.equal(mixed.items[1].effectiveLineCost, 205);
  const reopened = ctx.normalizePayload(kind, JSON.parse(JSON.stringify(mixed)));
  assert.equal(reopened.items[0].vatMode, "included");
  assert.equal(reopened.items[1].vatMode, "excluded");
  assert.equal(reopened.totalAmount, mixed.totalAmount);
  const report = ctx.buildReportVat([{ ...mixed, status: "confirmed" }], []);
  assert.equal(report.salesVat, 64);
  assert.equal(report.missingCount, 0);
}
const actual = ctx.normalizePayload("sales", { docType: "F", items: mixedItems });
assert.equal(actual.totalAmount, 432);
assert.equal(actual.vatSummary.vatTotal, 0);

const mixedSale = { id: "mix", documentKind: "sales", status: "confirmed", docType: "R", vatMode: "mixed", items: mixedItems };
assert.equal(ctx.resolveErpSalesPriceHints({ rows: [mixedSale], productId: "b", docType: "R", vatMode: "included" }).lastSale.value, 232);
assert.equal(ctx.buildCustomerProductHistory([mixedSale]).find((row) => row.productName === "B").lastPrice, 232);
console.log("PASS: mixed row VAT totals, draft round-trip, reporting and row-level price history");
