"use client";

import { listErpCaris } from "./erpCarisService";
import { listErpDocuments } from "./erpDocumentsService";
import { listErpCashAccounts, listErpCashMovements } from "./erpFinanceService";
import { ERP_COLLECTIONS } from "./erpCollections";
import { getErpSettings } from "./erpSettingsService";
import { listErpStockBalances, listErpStockMovements } from "./erpStockService";

function text(value) {
  return String(value ?? "").trim();
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round2(value) {
  return Math.round(num(value, 0) * 100) / 100;
}

function normalizeDateInput(value) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildDateTs(dateInput, mode = "start") {
  const normalized = normalizeDateInput(dateInput);
  if (!normalized) return null;
  const suffix = mode === "end" ? "T23:59:59.999" : "T00:00:00.000";
  return new Date(`${normalized}${suffix}`).getTime();
}

function isWithinDateRange(sortTime, startTs, endTs) {
  const time = num(sortTime, 0);
  if (startTs !== null && time < startTs) return false;
  if (endTs !== null && time > endTs) return false;
  return true;
}

function filterRowsByDateRange(rows, startTs, endTs) {
  return (Array.isArray(rows) ? rows : []).filter((item) =>
    isWithinDateRange(item.sortTime, startTs, endTs)
  );
}

function summarizeDocuments(rows, kind) {
  const confirmed = rows.filter((item) => item.status === "confirmed");
  const rDocs = confirmed.filter((item) => item.docType === "R");
  const fDocs = confirmed.filter((item) => item.docType === "F");
  const openDocs = confirmed.filter((item) => ["open", "partial"].includes(text(item.paymentStatus).toLowerCase()));

  return {
    kind,
    confirmedCount: confirmed.length,
    confirmedTotal: round2(confirmed.reduce((sum, item) => sum + num(item.totalAmount, 0), 0)),
    rCount: rDocs.length,
    rTotal: round2(rDocs.reduce((sum, item) => sum + num(item.totalAmount, 0), 0)),
    fCount: fDocs.length,
    fTotal: round2(fDocs.reduce((sum, item) => sum + num(item.totalAmount, 0), 0)),
    openCount: openDocs.length,
    openTotal: round2(
      openDocs.reduce(
        (sum, item) =>
          sum +
          num(
            item?.settlementSummary?.outstandingAmount,
            num(item.totalAmount, 0) - num(item?.settlementSummary?.settledAmount, 0)
          ),
        0
      )
    ),
  };
}

function buildPlatformReport(salesRows, settings) {
  const platformMap = new Map(
    (settings?.salesPlatforms || []).map((item) => [text(item.key), text(item.label) || text(item.key)])
  );

  const bucket = new Map();

  salesRows
    .filter((item) => item.status === "confirmed")
    .forEach((item) => {
      const key = text(item.platformKey || "unknown");
      const label = platformMap.get(key) || (key ? key.toUpperCase() : "Belirtilmedi");
      const current = bucket.get(key) || {
        key,
        label,
        count: 0,
        total: 0,
        rTotal: 0,
        fTotal: 0,
      };

      current.count += 1;
      current.total = round2(current.total + num(item.totalAmount, 0));
      if (item.docType === "R") current.rTotal = round2(current.rTotal + num(item.totalAmount, 0));
      if (item.docType === "F") current.fTotal = round2(current.fTotal + num(item.totalAmount, 0));
      bucket.set(key, current);
    });

  return Array.from(bucket.values()).sort((a, b) => b.total - a.total);
}

function buildSalesProfitabilityReport(salesRows, settings) {
  const platformMap = new Map(
    (settings?.salesPlatforms || []).map((item) => [text(item.key), text(item.label) || text(item.key)])
  );

  const confirmedSales = salesRows
    .filter((item) => item.status === "confirmed")
    .map((item) => {
      const revenue = round2(item.totalAmount);
      const cost = round2(item.realizedCostTotal);
      const grossProfit = round2(revenue - cost);
      const marginRate = revenue > 0 ? round2((grossProfit / revenue) * 100) : 0;
      const platformKey = text(item.platformKey || "unknown");
      return {
        id: item.id,
        docType: item.docType,
        dateLabel: item.dateLabel || "-",
        documentNo: item.documentNo || "-",
        invoiceNo: item.invoiceNo || "-",
        cariName: item.cariName || "-",
        platformKey,
        platformLabel: platformMap.get(platformKey) || (platformKey ? platformKey.toUpperCase() : "Belirtilmedi"),
        revenue,
        cost,
        grossProfit,
        marginRate,
        sortTime: num(item.sortTime, 0),
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);

  const platformBuckets = new Map();
  confirmedSales.forEach((item) => {
    const current = platformBuckets.get(item.platformKey) || {
      key: item.platformKey,
      label: item.platformLabel,
      documentCount: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      averageMarginRate: 0,
    };

    current.documentCount += 1;
    current.revenue = round2(current.revenue + item.revenue);
    current.cost = round2(current.cost + item.cost);
    current.grossProfit = round2(current.grossProfit + item.grossProfit);
    current.averageMarginRate =
      current.revenue > 0 ? round2((current.grossProfit / current.revenue) * 100) : 0;
    platformBuckets.set(item.platformKey, current);
  });

  const totalRevenue = round2(confirmedSales.reduce((sum, item) => sum + item.revenue, 0));
  const totalCost = round2(confirmedSales.reduce((sum, item) => sum + item.cost, 0));
  const totalGrossProfit = round2(totalRevenue - totalCost);

  return {
    summary: {
      documentCount: confirmedSales.length,
      totalRevenue,
      totalCost,
      totalGrossProfit,
      marginRate: totalRevenue > 0 ? round2((totalGrossProfit / totalRevenue) * 100) : 0,
      profitableCount: confirmedSales.filter((item) => item.grossProfit > 0).length,
      lossCount: confirmedSales.filter((item) => item.grossProfit < 0).length,
      zeroProfitCount: confirmedSales.filter((item) => item.grossProfit === 0).length,
    },
    byPlatform: Array.from(platformBuckets.values()).sort((a, b) => b.grossProfit - a.grossProfit),
    topProfitable: [...confirmedSales].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 10),
    topLossMaking: [...confirmedSales].sort((a, b) => a.grossProfit - b.grossProfit).slice(0, 10),
  };
}

function buildPurchaseCostReport(purchaseRows) {
  const confirmedPurchases = purchaseRows
    .filter((item) => item.status === "confirmed")
    .map((item) => {
      const goodsTotal = round2(item.goodsTotal);
      const additionalCostTotal = round2(item.additionalCostTotal);
      const landedCostTotal = round2(item.realizedCostTotal || item?.costSummary?.totalCost || item.totalAmount);
      const burdenRate = goodsTotal > 0 ? round2((additionalCostTotal / goodsTotal) * 100) : 0;

      return {
        id: item.id,
        docType: item.docType,
        dateLabel: item.dateLabel || "-",
        documentNo: item.documentNo || "-",
        invoiceNo: item.invoiceNo || "-",
        cariName: item.cariName || "-",
        goodsTotal,
        additionalCostTotal,
        landedCostTotal,
        burdenRate,
        sortTime: num(item.sortTime, 0),
      };
    })
    .sort((a, b) => b.sortTime - a.sortTime);

  const totalGoods = round2(confirmedPurchases.reduce((sum, item) => sum + item.goodsTotal, 0));
  const totalAdditional = round2(
    confirmedPurchases.reduce((sum, item) => sum + item.additionalCostTotal, 0)
  );
  const totalLanded = round2(confirmedPurchases.reduce((sum, item) => sum + item.landedCostTotal, 0));

  const supplierMap = new Map();
  confirmedPurchases.forEach((item) => {
    const key = item.cariName || "Bilinmeyen Cari";
    const current = supplierMap.get(key) || {
      cariName: key,
      documentCount: 0,
      goodsTotal: 0,
      additionalCostTotal: 0,
      landedCostTotal: 0,
      burdenRate: 0,
    };

    current.documentCount += 1;
    current.goodsTotal = round2(current.goodsTotal + item.goodsTotal);
    current.additionalCostTotal = round2(current.additionalCostTotal + item.additionalCostTotal);
    current.landedCostTotal = round2(current.landedCostTotal + item.landedCostTotal);
    current.burdenRate =
      current.goodsTotal > 0 ? round2((current.additionalCostTotal / current.goodsTotal) * 100) : 0;
    supplierMap.set(key, current);
  });

  return {
    summary: {
      documentCount: confirmedPurchases.length,
      totalGoods,
      totalAdditional,
      totalLanded,
      burdenRate: totalGoods > 0 ? round2((totalAdditional / totalGoods) * 100) : 0,
      costLoadedCount: confirmedPurchases.filter((item) => item.additionalCostTotal > 0).length,
    },
    topAdditionalCostDocs: [...confirmedPurchases]
      .sort((a, b) => b.additionalCostTotal - a.additionalCostTotal)
      .slice(0, 10),
    highestBurdenDocs: [...confirmedPurchases].sort((a, b) => b.burdenRate - a.burdenRate).slice(0, 10),
    bySupplier: Array.from(supplierMap.values()).sort((a, b) => b.additionalCostTotal - a.additionalCostTotal),
  };
}

function buildProductProfitabilityReport(salesRows, saleMovements) {
  const productMap = new Map();

  salesRows
    .filter((item) => item.status === "confirmed")
    .forEach((document) => {
      const items = Array.isArray(document.items) ? document.items : [];
      items.forEach((item) => {
        const productId = text(item.productId || item.productSku || item.productName);
        if (!productId) return;

        const current = productMap.get(productId) || {
          key: productId,
          productId: text(item.productId),
          sku: text(item.productSku),
          name: text(item.productName || item.productSku || "Adsiz urun"),
          soldQty: 0,
          revenue: 0,
          cost: 0,
          grossProfit: 0,
          marginRate: 0,
          rQtySold: 0,
          fQtySold: 0,
          fallbackCount: 0,
          documentRefs: new Set(),
        };

        current.soldQty = round2(current.soldQty + num(item.quantity, 0));
        current.revenue = round2(current.revenue + num(item.lineTotal, 0));
        current.documentRefs.add(document.id);
        productMap.set(productId, current);
      });
    });

  saleMovements
    .filter((item) => item.movementType === "sale")
    .forEach((movement) => {
      const key = text(movement.productId || movement.productSku || movement.productName);
      if (!key) return;

      const current = productMap.get(key) || {
        key,
        productId: text(movement.productId),
        sku: text(movement.productSku),
        name: text(movement.productName || movement.productSku || "Adsiz urun"),
        soldQty: 0,
        revenue: 0,
        cost: 0,
        grossProfit: 0,
        marginRate: 0,
        rQtySold: 0,
        fQtySold: 0,
        fallbackCount: 0,
        documentRefs: new Set(),
      };

      current.cost = round2(current.cost + num(movement.effectiveLineCost, 0));
      if (movement.bucket === "F") {
        current.fQtySold = round2(current.fQtySold + num(movement.quantity, 0));
      } else {
        current.rQtySold = round2(current.rQtySold + num(movement.quantity, 0));
      }
      if (movement.usedCostFallback) {
        current.fallbackCount += 1;
      }
      current.documentRefs.add(text(movement.documentId || movement.documentNo));
      productMap.set(key, current);
    });

  const rows = Array.from(productMap.values())
    .map((item) => {
      const grossProfit = round2(item.revenue - item.cost);
      return {
        id: item.key,
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        soldQty: round2(item.soldQty || (item.rQtySold + item.fQtySold)),
        revenue: round2(item.revenue),
        cost: round2(item.cost),
        grossProfit,
        marginRate: item.revenue > 0 ? round2((grossProfit / item.revenue) * 100) : 0,
        rQtySold: round2(item.rQtySold),
        fQtySold: round2(item.fQtySold),
        fallbackCount: item.fallbackCount,
        documentCount: item.documentRefs.size,
      };
    })
    .filter((item) => item.revenue > 0 || item.cost > 0 || item.soldQty > 0)
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const totalRevenue = round2(rows.reduce((sum, item) => sum + item.revenue, 0));
  const totalCost = round2(rows.reduce((sum, item) => sum + item.cost, 0));
  const totalGrossProfit = round2(totalRevenue - totalCost);

  return {
    summary: {
      productCount: rows.length,
      totalRevenue,
      totalCost,
      totalGrossProfit,
      marginRate: totalRevenue > 0 ? round2((totalGrossProfit / totalRevenue) * 100) : 0,
      totalSoldQty: round2(rows.reduce((sum, item) => sum + item.soldQty, 0)),
      fallbackCount: rows.reduce((sum, item) => sum + item.fallbackCount, 0),
    },
    topProfitable: [...rows].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 12),
    topLossMaking: [...rows].sort((a, b) => a.grossProfit - b.grossProfit).slice(0, 12),
    allRows: rows,
  };
}

function buildOpenDocuments(rows, kind) {
  return rows
    .filter((item) => item.status === "confirmed")
    .filter((item) => ["open", "partial"].includes(text(item.paymentStatus).toLowerCase()))
    .map((item) => ({
      id: item.id,
      kind,
      docType: item.docType,
      documentNo: item.documentNo || "-",
      invoiceNo: item.invoiceNo || "-",
      cariName: item.cariName || "-",
      dateLabel: item.dateLabel || "-",
      totalAmount: round2(item.totalAmount),
      settledAmount: round2(item?.settlementSummary?.settledAmount),
      outstandingAmount: round2(
        item?.settlementSummary?.outstandingAmount ??
          (num(item.totalAmount, 0) - num(item?.settlementSummary?.settledAmount, 0))
      ),
      paymentStatus: text(item.paymentStatus || "open"),
      sortTime: num(item.sortTime, 0),
    }))
    .sort((a, b) => b.sortTime - a.sortTime);
}

export async function getErpReportDashboard(filters = {}) {
  const startDate = normalizeDateInput(filters.startDate);
  const endDate = normalizeDateInput(filters.endDate);
  const startTs = buildDateTs(startDate, "start");
  const endTs = buildDateTs(endDate, "end");

  const [sales, purchases, stockBalances, cashAccounts, cashMovements, caris, settings, stockMovements] = await Promise.all([
    listErpDocuments(ERP_COLLECTIONS.SALES),
    listErpDocuments(ERP_COLLECTIONS.PURCHASES),
    listErpStockBalances(),
    listErpCashAccounts(),
    listErpCashMovements(250),
    listErpCaris(),
    getErpSettings(),
    listErpStockMovements(),
  ]);

  const filteredSales = filterRowsByDateRange(sales, startTs, endTs);
  const filteredPurchases = filterRowsByDateRange(purchases, startTs, endTs);
  const filteredCashMovements = filterRowsByDateRange(cashMovements, startTs, endTs);
  const filteredStockMovements = filterRowsByDateRange(stockMovements, startTs, endTs);

  const salesSummary = summarizeDocuments(filteredSales, "sales");
  const purchaseSummary = summarizeDocuments(filteredPurchases, "purchases");
  const salesProfitability = buildSalesProfitabilityReport(filteredSales, settings);
  const purchaseCosts = buildPurchaseCostReport(filteredPurchases);
  const productProfitability = buildProductProfitabilityReport(filteredSales, filteredStockMovements);
  const negativeStocks = stockBalances.filter((item) => item.totalQty < 0);
  const positiveStocks = stockBalances.filter((item) => item.totalQty > 0);
  const zeroStocks = stockBalances.filter((item) => item.totalQty === 0);
  const activeCaris = caris.filter((item) => item.isActive);
  const totalCashBalance = round2(cashAccounts.reduce((sum, item) => sum + num(item.currentBalance, 0), 0));

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      startDate,
      endDate,
      hasDateFilter: Boolean(startDate || endDate),
    },
    overview: {
      confirmedSalesTotal: salesSummary.confirmedTotal,
      confirmedPurchaseTotal: purchaseSummary.confirmedTotal,
      receivableOpenTotal: salesSummary.openTotal,
      payableOpenTotal: purchaseSummary.openTotal,
      totalCashBalance,
      negativeStockCount: negativeStocks.length,
      activeCariCount: activeCaris.length,
      totalProductCount: stockBalances.length,
    },
    salesSummary,
    purchaseSummary,
    salesProfitability,
    purchaseCosts,
    productProfitability,
    platformSales: buildPlatformReport(filteredSales, settings),
    openSales: buildOpenDocuments(filteredSales, "sales").slice(0, 12),
    openPurchases: buildOpenDocuments(filteredPurchases, "purchases").slice(0, 12),
    negativeStocks: negativeStocks.slice(0, 20),
    topPositiveStocks: positiveStocks.slice(0, 12),
    stockSnapshot: {
      positiveCount: positiveStocks.length,
      negativeCount: negativeStocks.length,
      zeroCount: zeroStocks.length,
    },
    cashAccounts: cashAccounts.slice(0, 12),
    recentCashMovements: filteredCashMovements.slice(0, 20),
    cariSnapshot: {
      activeCount: activeCaris.length,
      inactiveCount: caris.length - activeCaris.length,
    },
  };
}
