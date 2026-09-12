// Uses the existing atomic Firestore test adapter; never connects to live data.
const fs = require("node:fs");
const path = require("node:path");
const adapter = fs.readFileSync(path.join(__dirname, "test-erp-cancellation.cjs"), "utf8").split("async function main() {")[0];
const tests = async function () {
  load("erpVat.js");
  load("erpReportVat.js");
  load("erpCashMovementCancellation.js");
  const cancelCash = id => context.cancelErpCashMovement({ movementId: id, reason: "Mükerrer kayıt" });
  const currentCari = () => context.calculateErpCariBalance({ id: "c1" }, list("erp_sales"), list("erp_purchases"), list("erp_cari_movements"));
  for (const direction of ["in", "out"]) {
    reset();
    const movement = await context.createErpManualCashMovement({ accountId: "bank", cariId: "c1", cariName: "Customer", amount: 189999, direction });
    assert.equal(currentCari()[direction === "in" ? "payable" : "receivable"], 189999);
    await cancelCash(movement.id);
    assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1000);
    assert.equal(currentCari().payable + currentCari().receivable, 0);
    assert.equal(list("erp_cash_movements").length, 1, "No compensating fake cash flow");
    assert.equal(list("erp_cari_movements")[0].status, "cancelled");
    assert.equal((await context.listErpCashMovements())[0].status, "cancelled");
    assert.equal((await context.getErpReportDashboard()).recentCashMovements.length, 0);
    await unchanged(() => cancelCash(movement.id), /zaten/);
  }
  reset();
  const noCari = await context.createErpManualCashMovement({ accountId: "bank", amount: 10, direction: "out" });
  await cancelCash(noCari.id);
  assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1000);

  for (const kind of ["sales", "purchases"]) {
    reset();
    const invoice = await confirm(kind, [item(5, 20)], { instantPaymentEnabled: true, accountId: "bank", paidAmount: 30 });
    const collectionName = kind === "sales" ? "erp_sales" : "erp_purchases";
    const firstCash = list("erp_cash_movements")[0];
    const stockBefore = JSON.stringify(list("erp_stock_balances"));
    await context.createErpDocumentSettlement({ documentId: invoice, documentCollection: collectionName, accountId: "bank", amount: 70 });
    const secondCash = list("erp_cash_movements").find(row => row.id !== firstCash.id);
    assert.equal(get(collectionName, invoice).paymentStatus, "closed");
    await cancelCash(firstCash.id);
    assert.equal(get(collectionName, invoice).paymentStatus, "partial");
    assert.equal(get(collectionName, invoice).settlementSummary.outstandingAmount, 30);
    assert.equal(get(collectionName, invoice).payment.paidAmount, 0);
    assert.equal(get(collectionName, invoice).status, "confirmed");
    assert.equal(JSON.stringify(list("erp_stock_balances")), stockBefore);
    assert.equal((await context.getErpReportDashboard()).overview[kind === "sales" ? "confirmedSalesTotal" : "confirmedPurchaseTotal"], 100);
    await cancelCash(secondCash.id);
    assert.equal(get(collectionName, invoice).settlementSummary.outstandingAmount, 100);
    assert.equal(get(collectionName, invoice).paymentStatus, "open");
    assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1000);
    assert.equal(currentCari()[kind === "sales" ? "receivable" : "payable"], 100);
    // Payment cancellation must not prevent a subsequent invoice cancellation.
    await cancel(kind, invoice);
    assert.equal(get(collectionName, invoice).retainedAdvanceAmount, 0);
  }

  for (const kind of ["sales", "purchases"]) {
    reset();
    const invoice = await confirm(kind, [item(1, 100)], { instantPaymentEnabled: true, accountId: "bank", paidAmount: 100 });
    await cancel(kind, invoice);
    const advance = list("erp_cash_movements")[0];
    assert.equal(advance.advanceFromCancellation, true);
    await cancelCash(advance.id);
    assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1000);
    assert.equal(currentCari().receivable + currentCari().payable, 0);
    const invoiceRow = get(kind === "sales" ? "erp_sales" : "erp_purchases", invoice);
    assert.equal(invoiceRow.status, "cancelled");
    assert.equal(invoiceRow.retainedAdvanceAmount, 0);
    assert.equal(invoiceRow.cancelledAdvanceAmount, 100);
  }
  reset();
  const movement = await context.createErpManualCashMovement({ accountId: "bank", cariId: "c1", amount: 100 });
  const cari = list("erp_cari_movements")[0];
  get("erp_cari_movements", cari.id).amount = 99;
  await unchanged(() => cancelCash(movement.id), /uyuşmuyor/);
  get("erp_cari_movements", cari.id).amount = 100;
  await unchanged(() => context.cancelErpCashMovement({ movementId: movement.id, reason: " " }), /gerekçesini/);
  context.auth.currentUser = null;
  await unchanged(() => cancelCash(movement.id), /oturum/);
  context.auth.currentUser = { uid: "admin" };
  // Simulate another cancellation winning before the transaction commits.
  retryHook = () => cancelCash(movement.id);
  await assert.rejects(cancelCash(movement.id), /zaten/);
  assert.equal(get("erp_cash_accounts", "bank").currentBalance, 1000);
  console.log("PASS: incoming/outgoing/manual/linked/instant/retained-advance cancellation, invoice reopening, balances, revenue and stock preservation, reports, audit history, duplicate/retry/invalid atomic guards");
};
new Function("require", "__dirname", adapter + `\n(${tests.toString()})().catch(error => { console.error(error); process.exitCode = 1; });`)(require, __dirname);
