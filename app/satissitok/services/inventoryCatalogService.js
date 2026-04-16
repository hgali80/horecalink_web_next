function text(value) {
  return String(value || "").trim();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function buildProductSnapshot(productLike = {}) {
  const productId = text(productLike.productId || productLike.id);
  const sku = text(
    productLike.sku ||
      productLike.stock_code ||
      productLike.stockCode ||
      productLike.code
  );

  return {
    productId,
    sku,
    stockCode: text(productLike.stock_code || productLike.stockCode || sku),
    name: text(productLike.name || productLike.productName || productLike.title),
    unit: text(productLike.unit || productLike.unitKey || productLike.saleUnit),
    barcode: text(productLike.barcode),
    brand: text(productLike.brand),
    salePrice: num(productLike.price ?? productLike.unitPrice),
    vatRate: num(productLike.vatRate),
    productType: text(productLike.productType),
    stockTracked: productLike.stockTracked !== false,
  };
}

export function normalizeDocumentItemSnapshot(row = {}) {
  return {
    ...row,
    productSnapshot: buildProductSnapshot(row.productSnapshot || row),
  };
}
