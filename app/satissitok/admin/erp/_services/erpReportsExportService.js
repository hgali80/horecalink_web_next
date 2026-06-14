"use client";

function formatMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatDateForFile(value) {
  return String(value || "").replaceAll("-", "");
}

function addSheet(XLSX, workbook, sheetName, rows) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

export async function exportErpReportDashboardToExcel(dashboard) {
  if (!dashboard) {
    throw new Error("Disa aktarilacak rapor verisi bulunamadi.");
  }

  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default || xlsxModule;
  const workbook = XLSX.utils.book_new();
  const startDate = dashboard?.filters?.startDate || "";
  const endDate = dashboard?.filters?.endDate || "";
  const fileSuffix =
    startDate || endDate
      ? `${formatDateForFile(startDate || "baslangic")}_${formatDateForFile(endDate || "bitis")}`
      : "tum_tarih";

  addSheet(XLSX, workbook, "Ozet", [
    { metric: "Rapor Tarihi", value: dashboard.generatedAt },
    { metric: "Baslangic", value: startDate || "Tum Tarihler" },
    { metric: "Bitis", value: endDate || "Tum Tarihler" },
    { metric: "Onayli Satis Toplami", value: formatMoney(dashboard.overview.confirmedSalesTotal) },
    { metric: "Onayli Satinalma Toplami", value: formatMoney(dashboard.overview.confirmedPurchaseTotal) },
    { metric: "Tahsil Edilecek", value: formatMoney(dashboard.overview.receivableOpenTotal) },
    { metric: "Odeme Bekleyen", value: formatMoney(dashboard.overview.payableOpenTotal) },
    { metric: "Toplam Kasa Banka", value: formatMoney(dashboard.overview.totalCashBalance) },
    { metric: "Negatif Stok Sayisi", value: dashboard.overview.negativeStockCount },
    { metric: "Aktif Cari Sayisi", value: dashboard.overview.activeCariCount },
    { metric: "Urun Kapsami", value: dashboard.overview.totalProductCount },
  ]);

  addSheet(XLSX, workbook, "Platform Satis", (dashboard.platformSales || []).map((row) => ({
    Platform: row.label,
    Belge: row.count,
    R_Toplam: formatMoney(row.rTotal),
    F_Toplam: formatMoney(row.fTotal),
    Genel_Toplam: formatMoney(row.total),
  })));

  addSheet(XLSX, workbook, "Platform Karlilik", (dashboard.salesProfitability?.byPlatform || []).map((row) => ({
    Platform: row.label,
    Belge: row.documentCount,
    Ciro: formatMoney(row.revenue),
    Maliyet: formatMoney(row.cost),
    Brut_Kar: formatMoney(row.grossProfit),
    Marj_Yuzde: formatMoney(row.averageMarginRate),
  })));

  addSheet(XLSX, workbook, "Urun Karlilik", (dashboard.productProfitability?.allRows || []).map((row) => ({
    Urun: row.name,
    SKU: row.sku,
    Satilan_Miktar: formatMoney(row.soldQty),
    R_Satis_Miktari: formatMoney(row.rQtySold),
    F_Satis_Miktari: formatMoney(row.fQtySold),
    Ciro: formatMoney(row.revenue),
    Maliyet: formatMoney(row.cost),
    Brut_Kar: formatMoney(row.grossProfit),
    Marj_Yuzde: formatMoney(row.marginRate),
    Belge_Sayisi: row.documentCount,
    Fallback_Sayisi: row.fallbackCount,
  })));

  addSheet(XLSX, workbook, "Satis Karlilik", (dashboard.salesProfitability?.topProfitable || []).map((row) => ({
    Belge_No: row.documentNo,
    Fatura_No: row.invoiceNo,
    Cari: row.cariName,
    Platform: row.platformLabel,
    Ciro: formatMoney(row.revenue),
    Maliyet: formatMoney(row.cost),
    Brut_Kar: formatMoney(row.grossProfit),
    Marj_Yuzde: formatMoney(row.marginRate),
  })));

  addSheet(XLSX, workbook, "Satinalma Maliyet", (dashboard.purchaseCosts?.topAdditionalCostDocs || []).map((row) => ({
    Belge_No: row.documentNo,
    Fatura_No: row.invoiceNo,
    Cari: row.cariName,
    Mal_Bedeli: formatMoney(row.goodsTotal),
    Ek_Masraf: formatMoney(row.additionalCostTotal),
    Toplam_Maliyet: formatMoney(row.landedCostTotal),
    Yuk_Yuzde: formatMoney(row.burdenRate),
  })));

  addSheet(XLSX, workbook, "Acik Belgeler", [
    ...(dashboard.openSales || []).map((row) => ({
      Tur: "Satis",
      Belge_Tipi: row.docType,
      Belge_No: row.documentNo,
      Fatura_No: row.invoiceNo,
      Cari: row.cariName,
      Tarih: row.dateLabel,
      Kalan_Tutar: formatMoney(row.outstandingAmount),
      Durum: row.paymentStatus,
    })),
    ...(dashboard.openPurchases || []).map((row) => ({
      Tur: "Satinalma",
      Belge_Tipi: row.docType,
      Belge_No: row.documentNo,
      Fatura_No: row.invoiceNo,
      Cari: row.cariName,
      Tarih: row.dateLabel,
      Kalan_Tutar: formatMoney(row.outstandingAmount),
      Durum: row.paymentStatus,
    })),
  ]);

  const fileName = `erp_raporlari_${fileSuffix}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
