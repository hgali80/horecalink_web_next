"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";
import { ERP_COLLECTIONS } from "./erpCollections";
import {
  buildCounterDocId,
  formatCounterNumber,
  getNumberPrefix,
} from "./erpCounterService";

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

function getYear2(dateISO) {
  const date = dateISO ? new Date(dateISO) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return String(year).slice(-2);
}

function getCollectionName(kind) {
  return kind === "purchases" ? ERP_COLLECTIONS.PURCHASES : ERP_COLLECTIONS.SALES;
}

function normalizeDocType(value) {
  return text(value).toUpperCase() === "F" ? "F" : "R";
}

function buildSettlementSummary(totalAmount, paidAmount) {
  const invoiceAmount = num(totalAmount, 0);
  const settledAmount = Math.min(num(paidAmount, 0), invoiceAmount);
  const outstandingAmount = Math.max(invoiceAmount - settledAmount, 0);
  return {
    invoiceAmount,
    settledAmount,
    outstandingAmount,
    status: outstandingAmount <= 0 ? "closed" : settledAmount > 0 ? "partial" : "open",
  };
}

function getPaymentDirection(kind) {
  return kind === "sales" ? "in" : "out";
}

function normalizeItems(items = [], fallbackBucket = "R") {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const quantity = num(item?.quantity, 0);
      const unitPrice = num(item?.unitPrice, 0);
      const manualUnitCost = num(item?.manualUnitCost, 0);
      return {
        rowId: text(item?.rowId || `row_${index + 1}`),
        productId: text(item?.productId),
        productSku: text(item?.productSku),
        productName: text(item?.productName),
        unit: text(item?.unit || "adet"),
        quantity,
        unitPrice,
        lineTotal: round2(quantity * unitPrice),
        stockSourceType: text(item?.stockSourceType).toUpperCase() === "F" ? "F" : fallbackBucket,
        stockTracked: item?.stockTracked !== false,
        webPublished: item?.webPublished === true,
        manualUnitCost: manualUnitCost > 0 ? round2(manualUnitCost) : 0,
        notes: text(item?.notes),
      };
    })
    .filter((item) => item.productName || item.productSku || item.productId || item.quantity > 0);
}

function allocateAdditionalCost(items = [], additionalCostTotal = 0) {
  const rows = Array.isArray(items) ? items : [];
  const extraTotal = round2(additionalCostTotal);
  const baseTotal = round2(rows.reduce((sum, item) => sum + num(item.lineTotal, 0), 0));

  if (!rows.length || extraTotal <= 0 || baseTotal <= 0) {
    return rows.map((item) => ({
      ...item,
      allocatedAdditionalCost: 0,
      effectiveUnitCost: round2(item.unitPrice),
      effectiveLineCost: round2(item.lineTotal),
    }));
  }

  let distributed = 0;
  return rows.map((item, index) => {
    const rawShare =
      index === rows.length - 1
        ? round2(extraTotal - distributed)
        : round2((num(item.lineTotal, 0) / baseTotal) * extraTotal);
    distributed = round2(distributed + rawShare);
    const effectiveLineCost = round2(num(item.lineTotal, 0) + rawShare);
    const effectiveUnitCost =
      num(item.quantity, 0) > 0 ? round2(effectiveLineCost / num(item.quantity, 0)) : round2(item.unitPrice);

    return {
      ...item,
      allocatedAdditionalCost: rawShare,
      effectiveUnitCost,
      effectiveLineCost,
    };
  });
}

function buildCostSummary(kind, items, additionalCostTotal) {
  const goodsTotal = round2(items.reduce((sum, item) => sum + num(item.lineTotal, 0), 0));
  const costedItems = allocateAdditionalCost(items, additionalCostTotal);
  const totalCost = round2(costedItems.reduce((sum, item) => sum + num(item.effectiveLineCost, 0), 0));

  return {
    goodsTotal,
    additionalCostTotal: round2(additionalCostTotal),
    totalCost,
    affectsDocumentTotal: kind === "purchases",
    items: costedItems,
  };
}

async function ensureUniqueField(collectionName, field, value, currentId = "") {
  const needle = text(value);
  if (!needle) return;

  const snap = await getDocs(query(collection(db, collectionName), where(field, "==", needle)));
  const duplicate = snap.docs.find((item) => item.id !== currentId);
  if (duplicate) {
    throw new Error(`${field} zaten kullaniliyor: ${needle}`);
  }
}

async function reserveCounterNumber({
  transaction,
  deferredWrites,
  settings,
  kind,
  docType,
  counterType,
  dateISO,
}) {
  const yy = getYear2(dateISO);
  const collectionName =
    counterType === "draft" ? ERP_COLLECTIONS.DRAFT_COUNTERS : ERP_COLLECTIONS.INVOICE_COUNTERS;
  const counterId = buildCounterDocId({ kind, docType, counterType, yy });
  const ref = doc(db, collectionName, counterId);
  const snap = await transaction.get(ref);
  const current = snap.exists() ? Number(snap.data()?.lastSeq || 0) : 0;
  const nextSeq = current + 1;

  deferredWrites.push(() =>
    transaction.set(ref, {
      kind,
      docType,
      counterType,
      yy,
      lastSeq: nextSeq,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  );

  return {
    yy,
    seq: nextSeq,
    number: formatCounterNumber({
      prefix: getNumberPrefix(settings, kind, docType, counterType),
      yy,
      seq: nextSeq,
    }),
  };
}

async function reserveReceiptNumber({ transaction, deferredWrites, dateISO }) {
  const yy = getYear2(dateISO);
  const ref = doc(db, ERP_COLLECTIONS.RECEIPT_COUNTERS, yy);
  const snap = await transaction.get(ref);
  const current = snap.exists() ? Number(snap.data()?.lastSeq || 0) : 0;
  const nextSeq = current + 1;

  deferredWrites.push(() =>
    transaction.set(ref, {
      yy,
      lastSeq: nextSeq,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  );

  return `TH-${yy}-${String(nextSeq).padStart(5, "0")}`;
}

function buildCariMovementDirection(kind) {
  return kind === "sales" ? "alacak" : "borc";
}

function normalizePayload(kind, payload = {}) {
  const docType = normalizeDocType(payload.docType);
  const documentDate = text(payload.documentDate) || new Date().toISOString().slice(0, 10);
  const items = normalizeItems(payload.items, docType);
  const additionalCostTotal = round2(payload.additionalCostTotal);
  const costSummary = buildCostSummary(kind, items, additionalCostTotal);
  const totalAmount =
    kind === "purchases"
      ? round2(costSummary.goodsTotal + costSummary.additionalCostTotal)
      : round2(costSummary.goodsTotal);
  const paidAmount = payload.instantPaymentEnabled ? num(payload.paidAmount, 0) : 0;
  const cariId = text(payload.cariId);
  const cariName = text(payload.cariName);

  const base = {
    kind,
    docType,
    status: text(payload.status || "draft"),
    documentDate,
    cariId,
    cariName,
    cariSnapshot: cariName
      ? {
          id: cariId,
          name: cariName,
        }
      : null,
    warehouseKey: text(payload.warehouseKey),
    totalAmount,
    goodsTotal: costSummary.goodsTotal,
    additionalCostTotal: costSummary.additionalCostTotal,
    items: costSummary.items,
    costSummary: {
      goodsTotal: costSummary.goodsTotal,
      additionalCostTotal: costSummary.additionalCostTotal,
      totalCost: costSummary.totalCost,
    },
    notes: text(payload.notes),
    draftNo: text(payload.draftNo),
    documentNo: text(payload.documentNo),
    invoiceNo: text(payload.invoiceNo),
    draftNoManual: text(payload.draftNo) !== "",
    documentNoManual: text(payload.documentNo) !== "",
    invoiceNoManual: text(payload.invoiceNo) !== "",
    paymentStatus: payload.instantPaymentEnabled
      ? buildSettlementSummary(totalAmount, paidAmount).status
      : "open",
    payment: {
      enabled: payload.instantPaymentEnabled === true,
      method: text(payload.paymentMethod),
      accountId: text(payload.accountId),
      paidAmount,
      paidDate: text(payload.paidDate || documentDate),
    },
    settlementSummary: buildSettlementSummary(totalAmount, paidAmount),
  };

  if (kind === "sales") {
    base.platformKey = text(payload.platformKey);
  }

  return base;
}

function resolveOutgoingCost(balanceData = {}, bucket = "R") {
  const preferredQty = bucket === "R" ? num(balanceData.rQty, 0) : num(balanceData.fQty, 0);
  const preferredAvg = bucket === "R" ? num(balanceData.rAvgCost, 0) : num(balanceData.fAvgCost, 0);
  const otherAvg = bucket === "R" ? num(balanceData.fAvgCost, 0) : num(balanceData.rAvgCost, 0);
  const otherBucket = bucket === "R" ? "F" : "R";

  if (preferredQty > 0 && preferredAvg > 0) {
    return { unitCost: round2(preferredAvg), costBucket: bucket, usedFallback: false };
  }

  if (preferredAvg > 0) {
    return { unitCost: round2(preferredAvg), costBucket: bucket, usedFallback: false };
  }

  if (otherAvg > 0) {
    return { unitCost: round2(otherAvg), costBucket: otherBucket, usedFallback: true };
  }

  return { unitCost: 0, costBucket: bucket, usedFallback: false };
}

async function applyStockEffects({
  transaction,
  deferredWrites,
  ref,
  collectionName,
  kind,
  normalized,
  documentNo,
}) {
  let realizedCostTotal = 0;

  for (const item of normalized.items || []) {
    if (!item.productId || item.stockTracked === false || num(item.quantity, 0) <= 0) continue;

    const bucket =
      kind === "purchases"
        ? normalized.docType
        : text(item.stockSourceType).toUpperCase() === "F"
          ? "F"
          : "R";
    const quantity = num(item.quantity, 0);
    const balanceRef = doc(db, ERP_COLLECTIONS.STOCK_BALANCES, item.productId);
    const balanceSnap = await transaction.get(balanceRef);
    const balanceData = balanceSnap.exists() ? balanceSnap.data() || {} : {};
    const currentR = num(balanceData.rQty, 0);
    const currentF = num(balanceData.fQty, 0);
    const currentRAvg = num(balanceData.rAvgCost, 0);
    const currentFAvg = num(balanceData.fAvgCost, 0);

    let nextR = currentR;
    let nextF = currentF;
    let nextRAvg = currentRAvg;
    let nextFAvg = currentFAvg;
    let movementUnitCost = 0;
    let movementLineCost = 0;
    let movementExtraCost = 0;
    let costBucketUsed = bucket;
    let usedFallback = false;
    let manualCostApplied = false;
    let costSource = kind === "purchases" ? "purchase_effective" : "stock_average";

    if (kind === "purchases") {
      movementUnitCost = round2(item.effectiveUnitCost);
      movementExtraCost = round2(item.allocatedAdditionalCost);
      movementLineCost = round2(item.effectiveLineCost);

      if (bucket === "R") {
        nextR = round2(currentR + quantity);
        nextRAvg =
          nextR !== 0
            ? round2(((currentR * currentRAvg) + movementLineCost) / nextR)
            : 0;
      } else {
        nextF = round2(currentF + quantity);
        nextFAvg =
          nextF !== 0
            ? round2(((currentF * currentFAvg) + movementLineCost) / nextF)
            : 0;
      }
    } else {
      const manualUnitCost = num(item.manualUnitCost, 0);
      if (manualUnitCost > 0) {
        movementUnitCost = round2(manualUnitCost);
        manualCostApplied = true;
        costSource = "manual";
      } else {
        const outgoing = resolveOutgoingCost(balanceData, bucket);
        movementUnitCost = round2(outgoing.unitCost);
        costBucketUsed = outgoing.costBucket;
        usedFallback = outgoing.usedFallback === true;
        costSource = usedFallback ? "fallback" : "stock_average";
      }
      movementExtraCost = round2(item.allocatedAdditionalCost);
      movementLineCost = round2((movementUnitCost * quantity) + movementExtraCost);
      realizedCostTotal = round2(realizedCostTotal + movementLineCost);

      if (bucket === "R") {
        nextR = round2(currentR - quantity);
      } else {
        nextF = round2(currentF - quantity);
      }
    }

    deferredWrites.push(() =>
      transaction.set(balanceRef, {
        productId: item.productId,
        productSku: item.productSku,
        productName: item.productName,
        warehouseKey: normalized.warehouseKey,
        rQty: nextR,
        fQty: nextF,
        totalQty: round2(nextR + nextF),
        rAvgCost: round2(nextRAvg),
        fAvgCost: round2(nextFAvg),
        updatedAt: serverTimestamp(),
      }, { merge: true })
    );

    const movementRef = doc(collection(db, ERP_COLLECTIONS.STOCK_MOVEMENTS));
    deferredWrites.push(() => transaction.set(movementRef, {
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productName,
      warehouseKey: normalized.warehouseKey,
      bucket,
      movementType: kind === "purchases" ? "purchase" : "sale",
      direction: kind === "purchases" ? "in" : "out",
      quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      additionalCostShare: movementExtraCost,
      effectiveUnitCost: movementUnitCost,
      effectiveLineCost: movementLineCost,
      costBucketUsed,
      usedCostFallback: usedFallback,
      manualCostApplied,
      manualUnitCost: round2(item.manualUnitCost),
      costSource,
      documentId: ref.id,
      documentCollection: collectionName,
      documentNo,
      docType: normalized.docType,
      cariId: normalized.cariId,
      cariName: normalized.cariName,
      movementDate: normalized.documentDate,
      createdAt: serverTimestamp(),
    }));
  }

  return realizedCostTotal;
}

export async function saveErpDraftDocument({ kind, payload, settings }) {
  const collectionName = getCollectionName(kind);
  const normalized = normalizePayload(kind, { ...payload, status: "draft" });
  const currentId = text(payload.id);

  return runTransaction(db, async (transaction) => {
    const deferredWrites = [];
    const ref = currentId ? doc(db, collectionName, currentId) : doc(collection(db, collectionName));
    const existingSnap = currentId ? await transaction.get(ref) : null;
    const existing = existingSnap?.exists() ? existingSnap.data() : null;

    if (existing && normalizeDocType(existing.docType) !== normalized.docType && text(existing.status).toLowerCase() === "confirmed") {
      throw new Error("Onayli belgenin belge tipi bu fazda degistirilemez.");
    }

    if (existing && text(existing.status).toLowerCase() === "confirmed") {
      throw new Error("Onayli belgeyi taslak olarak yeniden kaydedemezsin. Bu fazda sadece taslak belgeler duzenlenebilir.");
    }

    let draftNo = existing?.draftNo || normalized.draftNo;

    if (!draftNo) {
      const reserved = await reserveCounterNumber({
        transaction,
        deferredWrites,
        settings,
        kind,
        docType: normalized.docType,
        counterType: "draft",
        dateISO: normalized.documentDate,
      });
      draftNo = reserved.number;
    }

    await ensureUniqueField(collectionName, "draftNo", draftNo, ref.id);

    deferredWrites.forEach((write) => write());

    transaction.set(
      ref,
      {
        ...normalized,
        status: "draft",
        draftNo,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { id: ref.id, draftNo };
  });
}

export async function confirmErpDocument({ kind, payload, settings }) {
  const collectionName = getCollectionName(kind);
  const normalized = normalizePayload(kind, { ...payload, status: "confirmed" });
  const currentId = text(payload.id);

  if (normalized.payment?.enabled === true && num(normalized.payment?.paidAmount, 0) <= 0) {
    throw new Error(
      `${kind === "sales" ? "Tahsilat" : "Odeme"} tutari sifirdan buyuk olmali. Finans hareketi olusturmayacaksan aninda ${kind === "sales" ? "tahsilat" : "odeme"} secimini kaldir.`
    );
  }

  if (normalized.documentNoManual && normalized.documentNo) {
    await ensureUniqueField(collectionName, "documentNo", normalized.documentNo, currentId);
  }

  if (normalized.invoiceNoManual && normalized.invoiceNo) {
    await ensureUniqueField(collectionName, "invoiceNo", normalized.invoiceNo, currentId);
  }

  return runTransaction(db, async (transaction) => {
    const deferredWrites = [];
    const ref = currentId ? doc(db, collectionName, currentId) : doc(collection(db, collectionName));
    const existingSnap = currentId ? await transaction.get(ref) : null;
    const existing = existingSnap?.exists() ? existingSnap.data() : null;

    if (existing && text(existing.status).toLowerCase() === "confirmed") {
      throw new Error("Onayli belgeyi yeniden islemek bu fazda kapali. Cift stok/finans etkisini onlemek icin simdilik sadece taslak belge duzenleme acik.");
    }

    let draftNo = existing?.draftNo || normalized.draftNo || null;
    if (!draftNo && normalized.status === "draft") {
      const reservedDraft = await reserveCounterNumber({
        transaction,
        deferredWrites,
        settings,
        kind,
        docType: normalized.docType,
        counterType: "draft",
        dateISO: normalized.documentDate,
      });
      draftNo = reservedDraft.number;
    }

    let documentNo = normalized.documentNo;
    if (!documentNo) {
      const reserved = await reserveCounterNumber({
        transaction,
        deferredWrites,
        settings,
        kind,
        docType: normalized.docType,
        counterType: "document",
        dateISO: normalized.documentDate,
      });
      documentNo = reserved.number;
    }

    let invoiceNo = normalized.invoiceNo;
    if (!invoiceNo) {
      const reserved = await reserveCounterNumber({
        transaction,
        deferredWrites,
        settings,
        kind,
        docType: normalized.docType,
        counterType: "invoice",
        dateISO: normalized.documentDate,
      });
      invoiceNo = reserved.number;
    }

    const paymentEnabled = normalized.payment?.enabled === true;
    const paidAmount = num(normalized.payment?.paidAmount, 0);
    let settlementId = existing?.settlementId || null;
    let receiptNo = existing?.payment?.receiptNo || null;

    if (paymentEnabled && paidAmount > 0) {
      if (!text(normalized.payment?.accountId)) {
        throw new Error("Aninda tahsilat / odeme icin kasa veya banka hesabi secmelisin.");
      }

      const accountRef = doc(db, ERP_COLLECTIONS.CASH_ACCOUNTS, normalized.payment.accountId);
      const accountSnap = await transaction.get(accountRef);
      if (!accountSnap.exists()) {
        throw new Error("Secilen finans hesabi bulunamadi.");
      }

      const accountData = accountSnap.data() || {};
      const currentBalance = num(accountData.currentBalance, num(accountData.openingBalance, 0));
      const direction = getPaymentDirection(kind);
      const nextBalance =
        direction === "in" ? currentBalance + paidAmount : currentBalance - paidAmount;

      deferredWrites.push(() =>
        transaction.set(accountRef, {
          currentBalance: nextBalance,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      );

      receiptNo = receiptNo || (await reserveReceiptNumber({
        transaction,
        deferredWrites,
        dateISO: normalized.payment.paidDate || normalized.documentDate,
      }));

      const settlementRef = existing?.settlementId
        ? doc(db, ERP_COLLECTIONS.DOCUMENT_SETTLEMENTS, existing.settlementId)
        : doc(collection(db, ERP_COLLECTIONS.DOCUMENT_SETTLEMENTS));
      const movementRef = doc(collection(db, ERP_COLLECTIONS.CASH_MOVEMENTS));

      settlementId = settlementRef.id;

      deferredWrites.push(() =>
        transaction.set(settlementRef, {
          documentId: ref.id,
          documentCollection: collectionName,
          documentKind: kind,
          documentNo,
          invoiceNo,
          receiptNo,
          cariId: normalized.cariId,
          cariName: normalized.cariName,
          amount: paidAmount,
          currency: "KZT",
          direction,
          method: normalized.payment.method,
          accountId: normalized.payment.accountId,
          status: "posted",
          movementDate: normalized.payment.paidDate || normalized.documentDate,
          createdAt: existing?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true })
      );

      deferredWrites.push(() => transaction.set(movementRef, {
        settlementId,
        documentId: ref.id,
        documentCollection: collectionName,
        documentKind: kind,
        documentNo,
        invoiceNo,
        receiptNo,
        kind: "document_settlement",
        direction,
        amount: paidAmount,
        currency: "KZT",
        movementDate: normalized.payment.paidDate || normalized.documentDate,
        method: normalized.payment.method,
        accountId: normalized.payment.accountId,
        accountName: text(accountData.name),
        accountSnapshot: {
          id: normalized.payment.accountId,
          name: text(accountData.name),
          type: text(accountData.type),
        },
        cariId: normalized.cariId,
        cariName: normalized.cariName,
        cariSnapshot: normalized.cariSnapshot,
        notes: normalized.notes,
        createdAt: serverTimestamp(),
      }));

      const cariMovementRef = doc(collection(db, ERP_COLLECTIONS.CARI_MOVEMENTS));
      deferredWrites.push(() => transaction.set(cariMovementRef, {
        cariId: normalized.cariId,
        cariName: normalized.cariName,
        documentId: ref.id,
        documentCollection: collectionName,
        documentKind: kind,
        documentNo,
        invoiceNo,
        receiptNo,
        movementKind: "document_settlement",
        direction: buildCariMovementDirection(kind),
        amount: paidAmount,
        currency: "KZT",
        method: normalized.payment.method,
        accountId: normalized.payment.accountId,
        accountName: text(accountData.name),
        movementDate: normalized.payment.paidDate || normalized.documentDate,
        notes: normalized.notes,
        createdAt: serverTimestamp(),
      }));
    }

    const realizedCostTotal = await applyStockEffects({
      transaction,
      deferredWrites,
      ref,
      collectionName,
      kind,
      normalized,
      documentNo,
    });

    deferredWrites.forEach((write) => write());

    transaction.set(
      ref,
      {
        ...normalized,
        status: "confirmed",
        draftNo,
        documentNo,
        invoiceNo,
        settlementId,
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        confirmedAt: serverTimestamp(),
        realizedCostTotal: kind === "sales" ? round2(realizedCostTotal) : round2(normalized.costSummary.totalCost),
        payment: {
          ...normalized.payment,
          receiptNo,
        },
      },
      { merge: true }
    );

    return { id: ref.id, draftNo, documentNo, invoiceNo, settlementId, receiptNo };
  });
}
