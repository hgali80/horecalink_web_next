// Report saved VAT amounts only; legacy records must not be treated as zero VAT.
export function buildReportVat(sales, purchases) {
  function summarize(rows) {
    let total = 0;
    let missingCount = 0;
    let documentCount = 0;
    for (const row of rows) {
      if (row.status !== "confirmed" || row.docType !== "R") continue;
      documentCount += 1;
      const amount = row.vatSummary?.vatTotal;
      if (!["included", "excluded"].includes(row.vatMode) ||
          amount === null || amount === undefined || amount === "" || !Number.isFinite(Number(amount))) {
        missingCount += 1;
      } else {
        total += Number(amount);
      }
    }
    return { total: Math.round(total * 100) / 100, missingCount, documentCount };
  }
  const output = summarize(sales);
  const input = summarize(purchases);
  return {
    salesVat: output.total,
    purchaseVat: input.total,
    netVat: Math.round((output.total - input.total) * 100) / 100,
    missingCount: output.missingCount + input.missingCount,
    documentCount: output.documentCount + input.documentCount,
  };
}
