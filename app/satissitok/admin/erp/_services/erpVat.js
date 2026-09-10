export const ERP_VAT_RATE = 16;
const round = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Missing mode denotes a legacy record, whose tax treatment is unknown.
export function calculateErpVatLine(quantity, unitPrice, docType, vatMode) {
  const amount = round(Number(quantity) * Number(unitPrice));
  const enabled = docType === "R" && ["included", "excluded"].includes(vatMode);
  const netTotal = enabled && vatMode === "included" ? round(amount / 1.16) : amount;
  const vatTotal = enabled ? (vatMode === "included" ? round(amount - netTotal) : round(netTotal * 0.16)) : 0;
  return { lineTotal: netTotal, netTotal, vatTotal, grossTotal: round(netTotal + vatTotal), vatRate: enabled ? ERP_VAT_RATE : 0 };
}

export function summarizeErpVat(items) {
  return items.reduce((sum, row) => ({
    netTotal: round(sum.netTotal + row.netTotal),
    vatTotal: round(sum.vatTotal + row.vatTotal),
    grossTotal: round(sum.grossTotal + row.grossTotal),
  }), { netTotal: 0, vatTotal: 0, grossTotal: 0 });
}
