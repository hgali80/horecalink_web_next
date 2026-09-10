// Runs real services with an atomic Firestore adapter; no live data or credentials.
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const base = path.join(__dirname, "../app/satissitok/admin/erp/_services");
const records = new Map();
let sequence = 0, clock = 0, committed = 0, retryHook = null;
const snapshot = ref => ({ id: ref.id, exists: () => records.has(ref.path), data: () => structuredClone(records.get(ref.path)) });
const refFor = key => ({ path: key, id: key.split("/").at(-1) });
const context = vm.createContext({
  console, db: {}, auth: { currentUser: { uid: "admin", displayName: "Test Admin" } },
  collection: (_, name) => name,
  doc: (...args) => refFor(args.length === 1 ? `${args[0]}/test-${++sequence}` : `${args[1]}/${args[2]}`),
  getDoc: async ref => snapshot(ref),
  query: (name, ...filters) => ({ name, filters }), where: (field, op, value) => ({ field, op, value }),
  orderBy: () => null, limit: () => null,
  getDocs: async query => {
    const { name, filters = [] } = typeof query === "string" ? { name: query } : query;
    return { docs: [...records.keys()].filter(key => key.startsWith(name + "/") && filters.filter(Boolean).every(f => records.get(key)[f.field] === f.value)).map(key => snapshot(refFor(key))) };
  },
  serverTimestamp: () => ({ seconds: 1800000000 + clock, nanoseconds: 0 }),
  buildCounterDocId: ({ kind, docType, counterType, yy }) => `${kind}-${docType}-${counterType}-${yy}`,
  formatCounterNumber: ({ prefix, yy, seq }) => `${prefix}-${yy}-${seq}`,
  getNumberPrefix: (_, kind, type, counter) => `${kind}-${type}-${counter}`,
  runTransaction: async (_, callback) => {
    clock++;
    for (let attempt = 0; attempt < 2; attempt++) {
      const writes = [];
      const result = await callback({
        get: async ref => { assert.equal(writes.length, 0, "All reads must precede writes"); return snapshot(ref); },
        set: (ref, fields, options) => writes.push([ref.path, fields, options]),
      });
      if (retryHook) { const hook = retryHook; retryHook = null; await hook(); continue; }
      for (const [key, fields, options] of writes) records.set(key, { ...(options?.merge ? records.get(key) : {}), ...structuredClone(fields) });
      committed++;
      return result;
    }
    throw new Error("retry failed");
  },
});
function load(name) {
  const source = fs.readFileSync(path.join(base, name), "utf8");
  const names = [...source.matchAll(/export (?:async )?(?:function|const) (\w+)/g)].map(match => match[1]);
  vm.runInContext(`(() => { ${source.replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "").replace(/^export /gm, "")} Object.assign(globalThis, { ${names.join(",")} }); })()`, context, { filename: name });
}
for (const name of ["erpCollections.js", "erpCashAccountRules.js", "erpDocumentsService.js", "erpFinanceService.js", "erpDocumentMutationService.js", "erpCancellationStock.js", "erpDocumentCancellationService.js", "erpCariBalance.js"]) load(name);
context.listErpProductOptions = async () => [{ id: "p1", name: "Product", sku: "P1" }];
context.listErpCaris = async () => [];
context.getErpSettings = async () => ({ salesPlatforms: [] });
load("erpStockService.js");
load("erpReportsService.js");
load("erpPriceMemoryService.js");
const get = (name, id) => records.get(`${name}/${id}`);
const list = name => [...records].filter(([key]) => key.startsWith(`${name}/`)).map(([key, row]) => ({ ...row, id: key.split("/").at(-1) }));
const item = (quantity, unitPrice, extra = {}) => ({ productId: "p1", productName: "Product", quantity, unitPrice, ...extra });
async function confirm(kind, items, extra = {}) {
  const result = await context.confirmErpDocument({ kind, settings: {}, payload: { docType: "R", cariId: "c1", cariName: "Customer", items, ...extra } });
  return result.id;
}
const cancel = (kind, documentId) => context.cancelErpDocument({ kind, documentId, reason: "Yanlış fatura" });
const balance = () => get("erp_stock_balances", "p1");
function reset() { records.clear(); records.set("erp_cash_accounts/bank", { name: "Bank", currency: "KZT", active: true, currentBalance: 1000 }); }
async function unchanged(work, pattern) {
  const before = JSON.stringify([...records]);
  await assert.rejects(work(), pattern);
  assert.equal(JSON.stringify([...records]), before, "Failed cancellation must not change any data");
}
async function main() {
  reset();
  const p1 = await confirm("purchases", [item(10, 10)]);
  const sale = await confirm("sales", [item(4, 30)], { instantPaymentEnabled: true, accountId: "bank", paidAmount: 30 });
  const p2 = await confirm("purchases", [item(10, 20)]);
  const later = await confirm("sales", [item(2, 40)]);
  assert.equal(get("erp_sales", later).realizedCostTotal, 32.5);
  await cancel("sales", sale);
  assert.equal(balance().rQty, 18);
  assert.equal(balance().rAvgCost, 15);
  assert.equal(get("erp_sales", later).realizedCostTotal, 30);
  assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1030);
  assert.equal(get("erp_sales", sale).retainedAdvanceAmount, 30);
  const cariBalance = context.calculateErpCariBalance({ id: "c1" }, list("erp_sales"), list("erp_purchases"), list("erp_cari_movements"));
  assert.equal(cariBalance.payable, 250); // 80 sale - 300 purchases - 30 retained receipt
  assert.equal(list("erp_cash_movements")[0].documentId, "");
  assert.equal(list("erp_cari_movements")[0].movementKind, "manual");
  assert.equal(list("erp_document_settlements")[0].status, "cancelled");
  const report = await context.getErpReportDashboard();
  assert.equal(report.overview.confirmedSalesTotal, 80);
  assert.equal(report.salesProfitability.summary.totalCost, 30);
  assert.equal(report.productProfitability.summary.totalCost, 30);
  assert.equal(report.productProfitability.summary.totalGrossProfit, 50);
  assert.equal(report.openSales.length, 1);
  assert.equal((await context.getErpPriceMemoryDataset()).sales.length, 1);
  await unchanged(() => cancel("sales", sale), /zaten/);
  await unchanged(() => context.confirmErpDocument({ kind: "sales", payload: { id: sale }, settings: {} }), /yeniden/);
  await unchanged(() => context.saveErpDraftDocument({ kind: "sales", payload: { id: sale }, settings: {} }), /değiştirilemez/);
  await unchanged(() => context.createErpDocumentSettlement({ documentId: sale, documentCollection: "erp_sales", accountId: "bank", amount: 1 }), /onaylı/);
  // Removing a purchase revalues a later confirmed sale; cancelling all restores zero.
  await cancel("purchases", p2);
  assert.equal(balance().rQty, 8);
  assert.equal(balance().rAvgCost, 10);
  assert.equal(get("erp_sales", later).realizedCostTotal, 20);
  await cancel("sales", later);
  await cancel("purchases", p1);
  assert.equal(balance().totalQty, 0);
  assert.equal(balance().rAvgCost, 0);
  assert.equal(list("erp_stock_movements").filter(row => row.status !== "cancelled").length, 0);

  // Multiple identical product rows, mixed buckets, manual cost and additional costs.
  reset();
  const duplicate = await confirm("purchases", [item(2, 10), item(3, 20)], { additionalCostTotal: 10 });
  assert.equal(balance().rQty, 5);
  assert.equal(balance().rAvgCost, 18);
  const fPurchase = await confirm("purchases", [item(5, 50)], { docType: "F" });
  const mixed = await confirm("sales", [item(1, 70, { stockSourceType: "R", manualUnitCost: 7 }), item(1, 70, { stockSourceType: "F" })], { additionalCostTotal: 4 });
  assert.equal(get("erp_sales", mixed).realizedCostTotal, 61);
  await cancel("purchases", fPurchase);
  assert.equal(get("erp_sales", mixed).realizedCostTotal, 29); // manual 7 + fallback R18 + extras4
  assert.equal(balance().fQty, -1);
  await cancel("sales", mixed);
  await cancel("purchases", duplicate);
  assert.equal(balance().totalQty, 0);

  // Partial, multiple and fully paid purchase payments remain real supplier advances.
  for (const amount of [0, 40, 100, 120]) {
    reset();
    const purchase = await confirm("purchases", [item(10, 10)], amount ? { instantPaymentEnabled: true, accountId: "bank", paidAmount: amount } : {});
    if (amount === 40) await context.createErpDocumentSettlement({ documentId: purchase, documentCollection: "erp_purchases", accountId: "bank", amount: 20 });
    const paid = amount === 40 ? 60 : amount;
    await cancel("purchases", purchase);
    assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1000 - paid);
    assert.equal(context.calculateErpCariBalance({ id: "c1" }, [], list("erp_purchases"), list("erp_cari_movements")).receivable, paid);
  }
  // Retry must discover a concurrently posted settlement, without double reversal.
  reset();
  const concurrent = await confirm("sales", [item(1, 100, { stockTracked: false })]);
  retryHook = () => context.createErpDocumentSettlement({ documentId: concurrent, documentCollection: "erp_sales", accountId: "bank", amount: 20 });
  await cancel("sales", concurrent);
  assert.equal(get("erp_sales", concurrent).retainedAdvanceAmount, 20);
  assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1020);

  reset();
  const broken = await confirm("purchases", [item(5, 10)]);
  balance().rQty = 999;
  await unchanged(() => cancel("purchases", broken), /uyuşmuyor/);
  balance().rQty = 5;
  await unchanged(() => context.cancelErpDocument({ kind: "purchases", documentId: broken, reason: " " }), /gerekçesini/);
  context.auth.currentUser = null;
  await unchanged(() => cancel("purchases", broken), /oturum/);
  context.auth.currentUser = { uid: "admin" };
  records.delete(list("erp_stock_movements").map(row => `erp_stock_movements/${row.id}`)[0]);
  await unchanged(() => cancel("purchases", broken), /uyuşmuyor/);
  console.log(`PASS: cancellation, R/F stock and cost replay, later-sale profitability, manual/fallback costs, duplicate product lines, payment advances, cari balances, transaction retries, duplicate/invalid cancellation, cancelled-document guards and atomic failures (${committed} commits).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
