function text(value) {
  return String(value ?? "").trim();
}

// Commercial offer unit prices already include the negotiated discount and VAT.
// Never replace them with a catalog price or add VAT again during conversion.
export function buildErpSaleFromOffer({ offer, offerId, docType, cari, products = [], settings = {} }) {
  if (!["R", "F"].includes(docType)) throw new Error("Resmî veya fiilî belge tipini seçin.");
  if (!cari?.id || !text(cari.name)) throw new Error("Satış için bir ERP carisi seçin.");
  if (cari.active === false) throw new Error("Pasif cari ile satış taslağı oluşturulamaz.");
  if (text(offer.currency || "KZT") !== "KZT") throw new Error("Yalnızca KZT teklifleri aktarılabilir.");
  if (!Array.isArray(offer.items) || !offer.items.length) throw new Error("Teklife en az bir ürün ekleyin.");

  const items = offer.items.map((item, index) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!text(item.name) || !Number.isFinite(quantity) || quantity <= 0 ||
        item.unitPrice == null || text(item.unitPrice) === "" || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`${index + 1}. satırın ürün adı, miktarı ve fiyatını kontrol edin.`);
    }
    const exactProduct = products.find((product) => product.id === text(item.productId));
    const skuMatches = text(item.sku) ? products.filter((product) => product.sku === text(item.sku)) : [];
    const product = exactProduct || (skuMatches.length === 1 ? skuMatches[0] : null);
    if (item.productId && !product) {
      throw new Error(`${index + 1}. satırdaki ürün ERP kataloğunda bulunamadı. Teklifteki ürünü güncelleyin.`);
    }
    if (product?.saleEnabled === false) throw new Error(`${index + 1}. satırdaki ürün satışa kapalı.`);
    return {
      rowId: `offer_${index + 1}`,
      productId: product?.id || "",
      productSku: text(item.sku || product?.sku),
      productName: text(item.name),
      unit: text(item.unit || product?.unit || "adet"),
      quantity,
      unitPrice,
      stockSourceType: docType,
      stockTracked: product ? product.stockTracked !== false : false,
      webPublished: product?.webPublished === true,
      notes: text(item.description),
    };
  });
  const defaultChoice = (rows = []) => rows.find((row) => row.default && row.active !== false) || rows.find((row) => row.active !== false);
  return {
    docType,
    vatMode: "included",
    documentDate: new Date().toISOString().slice(0, 10),
    cariId: cari.id,
    cariName: text(cari.name),
    cariSnapshot: {
      id: cari.id, name: text(cari.name), bin: text(cari.bin),
      address: text(cari.address || cari.legalAddress), legalAddress: text(cari.legalAddress || cari.address),
      phone: text(cari.phone), email: text(cari.email),
    },
    warehouseKey: defaultChoice(settings.warehouses)?.key || "",
    platformKey: defaultChoice(settings.salesPlatforms)?.key || "",
    items,
    instantPaymentEnabled: false,
    sourceCommercialOfferId: offerId,
    sourceCommercialOfferNo: text(offer.offerNo),
    sellerSnapshot: offer.seller || {},
    currency: "KZT",
    notes: text(offer.priceNote),
  };
}
