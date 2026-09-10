// Replay the existing moving-average ledger, without deleting its audit trail.
const round = value => Math.round(Number(value) * 100) / 100;
const number = value => Number(value || 0);
const active = row => !["cancelled", "canceled", "void"].includes(row.status);
const stamp = value => value?.seconds != null
  ? number(value.seconds) + number(value.nanoseconds) / 1e9
  : new Date(value || 0).getTime() / 1000;

function replay(origin, rows) {
  const balance = { ...origin };
  const costs = new Map();
  for (const row of rows) {
    const bucket = row.bucket === "F" ? "f" : "r";
    const other = bucket === "r" ? "f" : "r";
    const qty = number(row.quantity);
    if (!(qty > 0) || !["purchase", "sale"].includes(row.movementType)) {
      throw new Error("Stok geçmişinde desteklenmeyen hareket var; iptal öncesinde kayıtları kontrol edin.");
    }
    if (row.movementType === "purchase") {
      const next = round(balance[`${bucket}Qty`] + qty);
      balance[`${bucket}AvgCost`] = next !== 0
        ? round((balance[`${bucket}Qty`] * balance[`${bucket}AvgCost`] + number(row.effectiveLineCost)) / next)
        : 0;
      balance[`${bucket}Qty`] = next;
    } else {
      const manual = row.manualCostApplied === true || number(row.manualUnitCost) > 0;
      const fallback = !manual && balance[`${bucket}AvgCost`] <= 0 && balance[`${other}AvgCost`] > 0;
      const unitCost = round(manual ? row.manualUnitCost || row.effectiveUnitCost
        : balance[`${fallback ? other : bucket}AvgCost`]);
      costs.set(row.id, {
        effectiveUnitCost: unitCost,
        effectiveLineCost: round(unitCost * qty + number(row.additionalCostShare)),
        costBucketUsed: (fallback ? other : bucket).toUpperCase(),
        usedCostFallback: fallback,
        costSource: manual ? "manual" : fallback ? "fallback" : "stock_average",
      });
      balance[`${bucket}Qty`] = round(balance[`${bucket}Qty`] - qty);
    }
  }
  balance.totalQty = round(balance.rQty + balance.fQty);
  return { balance, costs };
}

export function planErpStockCancellation(current, history, documentId, documentCollection) {
  const rows = history.filter(active).sort((a, b) => stamp(a.createdAt) - stamp(b.createdAt)
    || number(a.stockSequence) - number(b.stockSequence) || a.id.localeCompare(b.id));
  const belongs = row => row.documentId === documentId && row.documentCollection === documentCollection;
  const removed = rows.filter(belongs);
  if (!removed.length) throw new Error("Faturanın stok hareketi bulunamadı; iptal uygulanmadı.");
  if (rows.some(row => !stamp(row.createdAt))) throw new Error("Stok hareketlerinin işlem sırası doğrulanamıyor; iptal uygulanmadı.");

  // A recorded opening balance is exact. Legacy ledgers are only rebuilt when
  // they demonstrably start at zero and reproduce the saved balances and costs.
  const origin = current.cancellationOrigin || { rQty: 0, fQty: 0, rAvgCost: 0, fAvgCost: 0 };
  const original = replay(origin, rows);
  for (const key of ["rQty", "fQty", "rAvgCost", "fAvgCost"]) {
    if (Math.abs(number(current[key]) - original.balance[key]) > 0.001) {
      throw new Error("Stok geçmişi mevcut bakiye/maliyet ile uyuşmuyor (açılış veya eski hareket kaydı eksik olabilir). İptal öncesinde stok geçmişi düzeltilmeli.");
    }
  }
  for (const row of rows.filter(row => row.movementType === "sale")) {
    if (Math.abs(original.costs.get(row.id).effectiveLineCost - number(row.effectiveLineCost)) > 0.001) {
      throw new Error("Geçmiş satış maliyeti doğrulanamadı; stok geçmişini kontrol edin. Hiçbir kayıt değiştirilmedi.");
    }
  }
  const next = replay(origin, rows.filter(row => !belongs(row)));
  const costChanges = rows.filter(row => !belongs(row) && row.movementType === "sale")
    .map(row => ({ row, cost: next.costs.get(row.id) }))
    .filter(({ row, cost }) => Object.entries(cost).some(([key, value]) => row[key] !== value));
  return { balance: next.balance, removed, costChanges };
}
