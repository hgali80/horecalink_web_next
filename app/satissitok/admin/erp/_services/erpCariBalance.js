// Positive net balance means a receivable; negative means a payable.
// Document settlements already reduce outstandingAmount, so only independent
// manual payments are applied separately here.
export function calculateErpCariBalance(cari, sales = [], purchases = [], movements = []) {
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const cents = value => Math.round(number(value) * 100);
  const belongs = row => String(row.cariId || row.cariSnapshot?.id || "") === String(cari.id);
  const outstanding = row => {
    if (!["confirmed", "completed"].includes(String(row.status).toLowerCase())) return 0;
    const summary = row.settlementSummary;
    if (summary?.outstandingAmount != null) return Math.max(0, cents(summary.outstandingAmount));
    if ((summary?.status || row.paymentStatus) === "closed") return 0;
    const settled = summary?.settledAmount ?? (row.payment?.enabled ? row.payment.paidAmount : 0);
    return Math.max(0, cents(row.totalAmount) - cents(settled));
  };
  let net = cents(cari.openingReceivable) - cents(cari.openingPayable);
  for (const row of sales.filter(belongs)) net += outstanding(row);
  for (const row of purchases.filter(belongs)) net -= outstanding(row);
  for (const row of movements.filter(belongs)) {
    if (["cancelled", "canceled", "void"].includes(row.status)) continue;
    if ((row.movementKind || row.kind || "manual") !== "manual" || row.documentId || row.settlementId) continue;
    if (row.direction === "borc") net += cents(row.amount);
    if (row.direction === "alacak") net -= cents(row.amount);
  }
  return { receivable: Math.max(net, 0) / 100, payable: Math.max(-net, 0) / 100 };
}
