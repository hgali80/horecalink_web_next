// Run without credentials: node scripts/test-erp-cash-accounts.cjs
// Executes the real finance service against an atomic in-memory Firestore adapter.
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const assert = require("node:assert/strict");
const base = path.join(__dirname, "../app/satissitok/admin/erp/_services");
const records = new Map();
let sequence = 0;
const snapshot = ref => { const key = ref.path || ref; return { id: key.split("/").at(-1), exists: () => records.has(key), data: () => records.get(key) }; };
const context = vm.createContext({
  db: {}, collection: (_, name) => name,
  doc: (...args) => { const key = args.length === 1 ? `${args[0]}/test-${++sequence}` : `${args[1]}/${args[2]}`; return { path: key, id: key.split("/").at(-1) }; },
  getDoc: async ref => snapshot(ref),
  getDocs: async ref => ({ docs: [...records.keys()].filter(key => key.startsWith(ref + "/")).map(snapshot) }),
  serverTimestamp: () => "2026-09-05T00:00:00Z",
  query: ref => ref, orderBy: () => {}, limit: () => {},
  buildCounterDocId: ({ kind, docType, counterType, yy }) => `${kind}-${docType}-${counterType}-${yy}`,
  formatCounterNumber: ({ prefix, yy, seq }) => `${prefix}-${yy}-${seq}`,
  getNumberPrefix: (_, kind, type, counter) => `${kind}-${type}-${counter}`,
  listErpDocuments: async () => [],
  runTransaction: async (_, callback) => {
    const writes = [];
    const result = await callback({
      get: async ref => { assert.equal(writes.length, 0, "Firestore reads must precede writes"); return snapshot(ref); },
      set: (ref, fields, options) => writes.push([ref.path, fields, options]),
    });
    for (const [ref, fields, options] of writes) records.set(ref, { ...(options?.merge ? records.get(ref) : {}), ...fields });
    return result;
  },
});
for (const name of ["erpCollections.js", "erpCashAccountRules.js", "erpFinanceService.js"]) {
  const source = fs.readFileSync(path.join(base, name), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "")
    .replace(/^export /gm, "");
  vm.runInContext(source, context, { filename: name });
}
vm.runInContext(`(() => {
  ${fs.readFileSync(path.join(base, "erpDocumentMutationService.js"), "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\s*/gm, "")
    .replace(/^export /gm, "")}
  globalThis.documentService = { confirmErpDocument };
})()`, context);

async function main() {
  const service = vm.runInContext("({ saveErpCashAccount, listErpCashAccountOptions, createErpManualCashMovement, createErpDocumentSettlement, getErpCashAccount })", context);
  const account = await service.saveErpCashAccount({ name: "Yeni kasa", type: "cash", currency: "KZT", openingBalance: 100, currentBalance: 9999 });
  assert.ok(account.id);
  assert.equal(account.currentBalance, 100);
  assert.equal((await service.listErpCashAccountOptions())[0].value, account.id);
  const accountId = account.id;
  await service.createErpManualCashMovement({ accountId, amount: 50, direction: "in", cariId: "cari-1", cariName: "Test cari" });
  assert.equal((await service.getErpCashAccount(accountId)).currentBalance, 150);
  const cari = [...records.entries()].find(([key]) => key.startsWith("erp_cari_movements/"))[1];
  assert.equal(cari.accountId, accountId);
  assert.equal(cari.direction, "alacak");
  await service.createErpManualCashMovement({ accountId, amount: 20, direction: "out" });
  assert.equal((await service.getErpCashAccount(accountId)).currentBalance, 130);
  // Simulate editing a stale form after the transactions changed its balance.
  const createdAt = records.get(`erp_cash_accounts/${accountId}`).createdAt;
  await service.saveErpCashAccount({ id: accountId, name: "Yeni isim", type: "cash", openingBalance: 0, currentBalance: 100 });
  assert.equal((await service.getErpCashAccount(accountId)).currentBalance, 130);
  assert.equal((await service.getErpCashAccount(accountId)).openingBalance, 100);
  assert.equal(records.get(`erp_cash_accounts/${accountId}`).createdAt, createdAt);
  for (const [collection, expected] of [["erp_sales", 170], ["erp_purchases", 130]]) {
    records.set(`${collection}/invoice`, { totalAmount: 100, status: "confirmed", cariId: "cari-1" });
    await service.createErpDocumentSettlement({ accountId, documentId: "invoice", documentCollection: collection, amount: 40 });
    assert.equal((await service.getErpCashAccount(accountId)).currentBalance, expected);
    assert.equal(records.get(`${collection}/invoice`).settlementSummary.outstandingAmount, 60);
    assert.equal(records.get(`${collection}/invoice`).paymentStatus, "partial");
  }
  const before = records.size;
  await assert.rejects(service.createErpDocumentSettlement({ accountId, documentId: "invoice", documentCollection: "erp_sales", amount: 99 }));
  assert.equal(records.size, before);
  await service.saveErpCashAccount({ id: accountId, name: "Yeni isim", type: "cash", active: false });
  assert.equal((await service.listErpCashAccountOptions()).length, 0);
  await assert.rejects(service.createErpManualCashMovement({ accountId, amount: 1 }), /Pasif/);
  await assert.rejects(service.createErpDocumentSettlement({ accountId, documentId: "invoice", documentCollection: "erp_sales", amount: 1 }), /Pasif/);
  assert.equal((await service.getErpCashAccount(accountId)).currentBalance, 130);
  assert.equal(records.size, before);
  records.set("erp_cash_accounts/usd", { name: "Legacy USD", currency: "USD", active: true });
  assert.equal((await service.listErpCashAccountOptions()).length, 0);
  await assert.rejects(service.createErpManualCashMovement({ accountId: "usd", amount: 1 }), /KZT/);
  await assert.rejects(service.saveErpCashAccount({ name: "USD", type: "bank", currency: "USD" }), /KZT/);
  await assert.rejects(service.saveErpCashAccount({ name: " ", type: "bank" }), /zorunlu/);
  await assert.rejects(service.saveErpCashAccount({ name: "Invalid", type: "bank", openingBalance: "abc" }), /sayi/);
  const bank = await service.saveErpCashAccount({ name: "New bank", type: "bank", openingBalance: 100 });
  const invoicePayload = { accountId: bank.id, instantPaymentEnabled: true, paidAmount: 25, cariId: "cari-1", cariName: "Test cari", items: [{ productName: "Service", quantity: 1, unitPrice: 50, stockTracked: false }] };
  for (const [kind, expected] of [["sales", 125], ["purchases", 100]]) {
    const result = await context.documentService.confirmErpDocument({ kind, payload: invoicePayload, settings: {} });
    assert.equal((await service.getErpCashAccount(bank.id)).currentBalance, expected);
    const document = records.get(`erp_${kind}/${result.id}`);
    assert.equal(document.payment.accountId, bank.id);
    assert.equal(document.settlementSummary.outstandingAmount, 25);
    assert.ok(result.receiptNo);
    assert.equal(records.get(`erp_document_settlements/${result.settlementId}`).accountId, bank.id);
    await assert.rejects(context.documentService.confirmErpDocument({ kind, payload: { ...invoicePayload, id: result.id }, settings: {} }), /Onayli/);
    assert.equal((await service.getErpCashAccount(bank.id)).currentBalance, expected);
  }
  await service.saveErpCashAccount({ id: bank.id, name: "New bank", type: "bank", active: false });
  const count = records.size;
  await assert.rejects(context.documentService.confirmErpDocument({ kind: "sales", payload: invoicePayload, settings: {} }), /Pasif/);
  await assert.rejects(context.documentService.confirmErpDocument({ kind: "purchases", payload: { ...invoicePayload, accountId: "usd" }, settings: {} }), /KZT/);
  assert.equal(records.size, count);
  console.log("PASS: account creation, shared options, receipts/payments, cari links, sales/purchase settlements and instant payments, stale edits, inactive/currency validation, duplicate confirmation, atomic failures.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
