const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Keep unlike tax treatments and units separate so averages remain comparable.
export function buildCustomerProductHistory(documents = [], { vatMode = "included", query = "", from = "", to = "", docType = "" } = {}) {
  const groups = new Map();
  const search = query.trim().toLocaleLowerCase("tr-TR");
  const rows = documents.filter((doc) => doc.documentKind === "sales" && doc.status === "confirmed")
    .slice().sort((a, b) => number(b.sortTime) - number(a.sortTime) || number(b.confirmationSortTime) - number(a.confirmationSortTime));
  for (const doc of rows) {
    const date = String(doc.documentDate || doc.invoiceDate || "").slice(0, 10);
    if ((from && (!date || date < from)) || (to && (!date || date > to)) || (docType && doc.docType !== docType)) continue;
    const knownVat = doc.docType === "R" && ["included", "excluded"].includes(doc.vatMode);
    const basis = doc.docType === "F" ? "F" : knownVat ? "R" : "R-unknown";
    for (const [index, item] of (doc.items || []).entries()) {
      const quantity = number(item.quantity);
      if (quantity <= 0) continue;
      if (search && !`${item.productName || ""} ${item.productSku || ""}`.toLocaleLowerCase("tr-TR").includes(search)) continue;
      const productKey = item.productId || item.productSku || item.productName;
      if (!productKey) continue;
      const unit = item.unit || "adet";
      const key = JSON.stringify([productKey, unit, basis]);
      const originalPrice = number(item.unitPrice);
      const price = knownVat && doc.vatMode !== vatMode
        ? vatMode === "included" ? originalPrice * 1.16 : originalPrice / 1.16
        : originalPrice;
      if (!groups.has(key)) groups.set(key, {
        id: key, productName: item.productName || item.productSku || productKey,
        productSku: item.productSku || "", unit, basis,
        priceLabel: basis === "F" ? "F · Kayıtlı fiyat" : basis === "R-unknown" ? "R · KDV bilgisi yok" : `R · KDV ${vatMode === "included" ? "dahil" : "hariç"}`,
        quantity: 0, total: 0, lastPrice: round(price), lastDate: doc.dateLabel || date || "-", history: [],
      });
      const group = groups.get(key);
      group.quantity += quantity;
      group.total += price * quantity;
      group.history.push({ id: `${doc.id}_${index}`, documentId: doc.id, documentNo: doc.documentNo || doc.id,
        date: doc.dateLabel || date || "-", quantity, price: round(price) });
    }
  }
  return [...groups.values()].map((group) => ({ ...group,
    quantity: Math.round(group.quantity * 1000) / 1000,
    averagePrice: round(group.total / group.quantity),
  }));
}
