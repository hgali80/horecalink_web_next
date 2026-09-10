"use client";

import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { ERP_COLLECTIONS } from "./erpCollections";
import { planErpStockCancellation } from "./erpCancellationStock";

const round = value => Math.round(Number(value || 0) * 100) / 100;
const active = row => !["cancelled", "canceled", "void"].includes(row.status);

async function readRows(transaction, collectionName, field, value) {
  // Re-query on every retry. The parent document and product balance reads
  // serialize this operation with confirmations, settlements and cancellations.
  const snap = await getDocs(query(collection(db, collectionName), where(field, "==", value)));
  const rows = [];
  for (const item of snap.docs) {
    const ref = doc(db, collectionName, item.id);
    const fresh = await transaction.get(ref);
    if (fresh.exists()) rows.push({ ...fresh.data(), id: item.id, ref });
  }
  return rows;
}

export async function cancelErpDocument({ kind, documentId, reason }) {
  if (!["sales", "purchases"].includes(kind) || !documentId) throw new Error("Geçerli bir fatura seçin.");
  const cancellationReason = String(reason || "").trim();
  if (!cancellationReason || cancellationReason.length > 1000) throw new Error("İptal gerekçesini girin (en fazla 1000 karakter).");
  const user = auth.currentUser;
  if (!user) throw new Error("İptal için oturum açmalısınız.");
  const collectionName = kind === "sales" ? ERP_COLLECTIONS.SALES : ERP_COLLECTIONS.PURCHASES;
  const ref = doc(db, collectionName, documentId);

  return runTransaction(db, async transaction => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) throw new Error("Fatura bulunamadı.");
    const record = snap.data();
    if (["cancelled", "canceled"].includes(record.status)) throw new Error("Bu fatura zaten iptal edilmiş.");
    if (!["confirmed", "completed"].includes(record.status)) throw new Error("Yalnızca onaylanmış faturalar iptal edilebilir.");
    const writes = [];
    const audit = { cancelledAt: serverTimestamp(), cancelledBy: user.uid, cancellationReason };
    const stockRows = await readRows(transaction, ERP_COLLECTIONS.STOCK_MOVEMENTS, "documentId", documentId);
    const ownStock = stockRows.filter(row => row.documentCollection === collectionName && active(row));
    const expected = (record.items || []).filter(row => row.productId && row.stockTracked !== false && Number(row.quantity) > 0);
    const quantities = rows => {
      const map = new Map();
      for (const row of rows) {
        const key = `${row.productId}/${row.bucket || (kind === "purchases" ? record.docType : row.stockSourceType) || "R"}`;
        map.set(key, round((map.get(key) || 0) + Number(row.quantity)));
      }
      return map;
    };
    const expectedQty = quantities(expected), actualQty = quantities(ownStock);
    if (expectedQty.size !== actualQty.size || [...expectedQty].some(([key, qty]) => actualQty.get(key) !== qty)) {
      throw new Error("Fatura satırları ile stok hareketleri uyuşmuyor. İptal öncesinde kayıtları kontrol edin.");
    }
    const saleDeltas = new Map();
    for (const productId of new Set(ownStock.map(row => row.productId))) {
      const balanceRef = doc(db, ERP_COLLECTIONS.STOCK_BALANCES, productId);
      const balanceSnap = await transaction.get(balanceRef);
      if (!balanceSnap.exists()) throw new Error("Ürünün stok bakiyesi bulunamadı.");
      const history = await readRows(transaction, ERP_COLLECTIONS.STOCK_MOVEMENTS, "productId", productId);
      const plan = planErpStockCancellation(balanceSnap.data(), history, documentId, collectionName);
      writes.push(() => transaction.set(balanceRef, { ...plan.balance, updatedAt: serverTimestamp() }, { merge: true }));
      for (const row of plan.removed) {
        writes.push(() => transaction.set(row.ref, { status: "cancelled", ...audit }, { merge: true }));
      }
      for (const { row, cost } of plan.costChanges) {
        if (row.documentCollection !== ERP_COLLECTIONS.SALES || !row.documentId) throw new Error("Bağlı satış kaydı doğrulanamıyor.");
        saleDeltas.set(row.documentId, round((saleDeltas.get(row.documentId) || 0) + cost.effectiveLineCost - Number(row.effectiveLineCost || 0)));
        writes.push(() => transaction.set(row.ref, {
          ...cost, originalCost: row.originalCost || { effectiveUnitCost: row.effectiveUnitCost, effectiveLineCost: row.effectiveLineCost },
          recalculatedAt: serverTimestamp(), recalculatedByCancellation: `${collectionName}/${documentId}`,
        }, { merge: true }));
      }
    }
    for (const [saleId, delta] of saleDeltas) {
      const saleRef = doc(db, ERP_COLLECTIONS.SALES, saleId);
      const saleSnap = await transaction.get(saleRef);
      if (!saleSnap.exists() || !["confirmed", "completed"].includes(saleSnap.data().status)) throw new Error("Bağlı satış faturası doğrulanamıyor.");
      const sale = saleSnap.data();
      writes.push(() => transaction.set(saleRef, {
        realizedCostTotal: round(Number(sale.realizedCostTotal || 0) + delta),
        originalRealizedCostTotal: sale.originalRealizedCostTotal ?? sale.realizedCostTotal ?? 0,
        updatedAt: serverTimestamp(), recalculatedByCancellation: `${collectionName}/${documentId}`,
      }, { merge: true }));
    }
    const linked = {};
    for (const name of [ERP_COLLECTIONS.DOCUMENT_SETTLEMENTS, ERP_COLLECTIONS.CASH_MOVEMENTS, ERP_COLLECTIONS.CARI_MOVEMENTS]) {
      linked[name] = (await readRows(transaction, name, "documentId", documentId))
        .filter(row => row.documentCollection === collectionName && active(row));
    }
    const settlements = linked[ERP_COLLECTIONS.DOCUMENT_SETTLEMENTS];
    const cash = linked[ERP_COLLECTIONS.CASH_MOVEMENTS];
    const cari = linked[ERP_COLLECTIONS.CARI_MOVEMENTS];
    const total = rows => round(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    if (total(settlements) !== total(cash) || total(cash) !== total(cari)
      || total(settlements) !== round(Math.max(Number(record.settlementSummary?.settledAmount || 0), record.payment?.enabled ? Number(record.payment.paidAmount || 0) : 0))
      || cari.some(row => row.movementKind !== "document_settlement")) {
      throw new Error("Faturanın ödeme, kasa ve cari kayıtları uyuşmuyor. İptal öncesinde kayıtları kontrol edin.");
    }
    for (const row of settlements) {
      writes.push(() => transaction.set(row.ref, { status: "cancelled", ...audit, retainedAsAdvance: true }, { merge: true }));
    }
    for (const row of [...cash, ...cari]) {
      writes.push(() => transaction.set(row.ref, {
        documentId: "", documentCollection: "", documentKind: "", documentNo: "", invoiceNo: "", settlementId: "",
        originalDocumentId: documentId, originalDocumentCollection: collectionName,
        originalDocumentNo: record.documentNo || "", originalInvoiceNo: record.invoiceNo || "",
        originalSettlementId: row.settlementId || "", kind: "manual", movementKind: "manual",
        advanceFromCancellation: true, cancellationReason, detachedAt: serverTimestamp(), detachedBy: user.uid,
        notes: `${row.notes || ""}\nİptal edilen ${record.invoiceNo || record.documentNo || documentId} faturasından avans. ${cancellationReason}`.trim(),
      }, { merge: true }));
    }
    if (writes.length > 440) throw new Error("Bu faturanın bağlı hareketleri tek işlem sınırını aşıyor. Toplu düzeltme gerekli; hiçbir kayıt değiştirilmedi.");
    writes.forEach(write => write());
    transaction.set(ref, {
      status: "cancelled", ...audit, cancelledByName: user.displayName || user.email || user.uid,
      updatedAt: serverTimestamp(), paymentStatus: "cancelled",
      settlementSummary: { invoiceAmount: 0, settledAmount: 0, outstandingAmount: 0, status: "cancelled" },
      originalSettlementSummary: record.settlementSummary || null,
      retainedAdvanceAmount: total(cash), recalculatedSalesCount: saleDeltas.size,
    }, { merge: true });
    return { retainedAdvanceAmount: total(cash), recalculatedSalesCount: saleDeltas.size,
      cancelledBy: user.uid, cancelledByName: user.displayName || user.email || user.uid };
  });
}
