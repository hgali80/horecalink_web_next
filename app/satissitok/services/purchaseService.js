// app/satissitok/services/purchaseService.js
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForPurchase,
  writePurchaseStockMovements,
  writeStockBalancesWithAvgCost,
} from "./stockService";

/* ===============================
   FATURA FORMAT (UI İLE AYNI)
   R-26-000001 / F-26-000001
================================ */

function pad6(n) {
  return String(Number(n) || 0).padStart(6, "0");
}

function year2FromDateISO(dateISO) {
  if (!dateISO) return String(new Date().getFullYear()).slice(-2);
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime())
    ? String(new Date().getFullYear()).slice(-2)
    : String(d.getFullYear()).slice(-2);
}

function formatInvoiceNo(type, yy, seq) {
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${yy}-${pad6(seq)}`;
}

/* =========================================================
   CREATE PURCHASE (COUNTER + AUTO/MANUEL DÜZELTİLDİ)
========================================================= */

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType; // official | actual

    // Depo (yeni model) – satınalma ekranında seçimi yoksa varsayılan: main
    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";

    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();

    // UI: kullanıcı inputa dokunmadıysa true gönderiyor
    const invoiceNoAuto = payload.invoiceNoAuto === true;

    /* =====================
       READ PHASE
    ===================== */

    // ✅ Sayaç her kayıt için tükecek
    const counterRef = doc(db, "counters", "purchases");
    const counterSnap = await transaction.get(counterRef);

    if (!counterSnap.exists()) {
      throw new Error("Sayaç bulunamadı: counters/purchases");
    }

    const data = counterSnap.data();
    const key = type === "official" ? "official" : "actual";

    const currentSeq = Number(data[key] || 0);
    const nextSeq = currentSeq + 1;

    // ✅ Auto invoice her zaman counter’dan üretilir
    const yy = year2FromDateISO(payload.documentDate);
    const autoInvoice = formatInvoiceNo(type, yy, nextSeq);

    // ✅ Kaydedilecek invoiceNo seçimi:
    // - invoiceNoAuto=true  => autoInvoice
    // - invoiceNoAuto=false => manualInvoice (boşsa autoInvoice)
    const invoiceNo = invoiceNoAuto ? autoInvoice : (manualInvoice || autoInvoice);

    const existingBalances = await readStockBalancesForPurchase({
      transaction,
      items: payload.items || [],
    });

    /* =====================
       WRITE PHASE
    ===================== */

    // ✅ Sayaç HER SATINALMADA güncellenecek
    transaction.update(counterRef, {
      [key]: nextSeq,
    });

    const purchaseRef = doc(collection(db, "purchases"));

    transaction.set(purchaseRef, {
      supplierName: payload.supplierName || "",
      supplierCariId: payload.supplierCariId || null,

      invoiceNo,
      documentNo: invoiceNo,

      documentDate: payload.documentDate
        ? new Date(payload.documentDate)
        : null,

      purchaseType: type,
      warehouseKey,
      taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
      vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

      items: payload.items || [],
      totals: payload.totals || {},

      status: "completed",

      createdAt: serverTimestamp(),
    });

    /* =====================
       STOK HAREKETLERİ
    ===================== */

    writePurchaseStockMovements({
      transaction,
      purchaseId: purchaseRef.id,
      purchaseType: type,
      items: payload.items || [],
      supplierName: payload.supplierName || "",
      invoiceNo,
      documentDate: payload.documentDate || null,
      currency: "KZT",
      warehouseKey,
    });

    writeStockBalancesWithAvgCost({
      transaction,
      purchaseType: type,
      items: payload.items || [],
      existingBalances,
      warehouseKey,
    });

    /* =====================
       CARİ HAREKETİ
    ===================== */

    if (payload.supplierCariId) {
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,

        operationDate: payload.documentDate
          ? new Date(payload.documentDate)
          : null,

        dueDate: null,

        operationType: "purchase_invoice",
        operationCategory: payload.operationCategory || "trade_goods",

        documentNo: invoiceNo,

        debit: 0,
        credit: Number(payload.totals?.gross || 0),

        currency: "KZT",

        description: payload.description || "Satınalma faturası",

        createdAt: serverTimestamp(),
      });
    }

    return purchaseRef.id;
  });
}

/* =========================================================
   CANCEL PURCHASE (HİÇ DOKUNULMADI)
========================================================= */

export async function cancelPurchase({ purchaseId }) {
  if (!purchaseId) throw new Error("purchaseId zorunlu");

  return await runTransaction(db, async (transaction) => {
    const purchaseRef = doc(db, "purchases", purchaseId);
    const snap = await transaction.get(purchaseRef);

    if (!snap.exists()) throw new Error("Satınalma bulunamadı");

    const purchase = snap.data();
    if (purchase.status === "cancelled") return true;

    const items = purchase.items || [];
    const type = purchase.purchaseType;

    const existingBalances = await readStockBalancesForPurchase({
      transaction,
      items,
    });

    writePurchaseStockMovements({
      transaction,
      purchaseId: purchaseRef.id,
      purchaseType: type,
      items,
      supplierName: purchase.supplierName || "",
      invoiceNo: purchase.invoiceNo,
      documentDate: purchase.documentDate || null,
      currency: "KZT",
      reverse: true,
    });

    writeStockBalancesWithAvgCost({
      transaction,
      purchaseType: type,
      items,
      existingBalances,
      reverse: true,
    });

    if (purchase.supplierCariId) {
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: purchase.supplierCariId,
        operationDate: new Date(),
        operationType: "purchase_cancel",
        documentNo: purchase.invoiceNo,
        debit: Number(purchase.totals?.gross || 0),
        credit: 0,
        currency: "KZT",
        description: "Satınalma faturası iptali",
        createdAt: serverTimestamp(),
      });
    }

    transaction.update(purchaseRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });

    return true;
  });
}