function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getProductOrderValue(product) {
  const order = toFiniteNumber(product?.order);
  if (order !== null) return order;

  const sortOrder = toFiniteNumber(product?.sortOrder);
  if (sortOrder !== null) return sortOrder;

  return 999999;
}

export function compareProductsByCategoryOrder(a, b) {
  const orderDiff = getProductOrderValue(a) - getProductOrderValue(b);
  if (orderDiff !== 0) return orderDiff;

  return String(a?.name || a?.name_tr || "").localeCompare(
    String(b?.name || b?.name_tr || ""),
    "ru"
  );
}
