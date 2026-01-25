// app/satissitok/services/purchaseService.js
// app/satissitok/services/purchaseService.js
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "@/firebase";
// import { addPurchaseStockMovements } from "./stockService"; // şimdilik kapalı
import { addPurchaseStockMovements, applyPurchaseToStockBalances } from "./stockService";

function formatInvoiceNo(type, seq) {
  const year = new Date().getFullYear().toString().slice(-2);
  const prefix = type === "official" ? "R" : "F";
  return `${prefix}-${year}${String(seq).padStart(6, "0")}`;
}

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType; // official | actual

    // ✅ UI tarafı documentNo gönderiyor, servis invoiceNo bekliyordu
    // İkisini de destekle (bozmadan)
    let invoiceNo = (payload.invoiceNo ?? payload.documentNo ?? "").trim();

    // 🔢 SADECE BOŞSA SAYAÇTAN ÜRET
    if (!invoiceNo) {
      const counterRef = doc(db, "purchase_counters", "main");
      const counterSnap = await transaction.get(counterRef);

      const counters = counterSnap.exists()
        ? counterSnap.data()
        : { official: 0, actual: 0 };

      const nextSeq = (counters[type] || 0) + 1;
      invoiceNo = formatInvoiceNo(type, nextSeq);

      transaction.set(
        counterRef,
        { [type]: nextSeq },
        { merge: true }
      );
    }

    const purchaseRef = doc(collection(db, "purchases"));

    const purchaseData = {
      supplierName: payload.supplierName || "",
      invoiceNo, // ✅ ARTIK GERÇEK FATURA NO

      // ✅ UI tarafındaki PurchaseForm documentNo ile sorguluyor; geriye uyum için aynısını da yaz.
      documentNo: invoiceNo,

      documentDate: payload.documentDate
        ? new Date(payload.documentDate)
        : null,

      purchaseType: type,
      taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
      vatMode: type === "official" ? payload.vatMode || "inclusive" : null,

      items: (payload.items || []).map((item) => ({
        productId: item.productId,
        productName: item.productName || "",
        unit: item.unit || "",
        qty: Number(item.qty) || 0,

        unitPrice: Number(item.unitPrice) || 0,

        netUnitPrice: Number(item.netUnitPrice) || 0,
        vatUnitPrice: Number(item.vatUnitPrice) || 0,
        grossUnitPrice: Number(item.grossUnitPrice) || 0,

        netLineTotal: Number(item.netLineTotal) || 0,
        vatLineTotal: Number(item.vatLineTotal) || 0,
        grossLineTotal: Number(item.grossLineTotal) || 0,
      })),

      totals: {
        net: Number(payload.totals?.net || 0),
        tax: Number(payload.totals?.tax || 0),
        gross: Number(payload.totals?.gross || 0),
      },

      createdAt: serverTimestamp(),
    };

    transaction.set(purchaseRef, purchaseData);

    // ✅ STOK ENTEGRASYONU (aynı transaction içinde)
    // 1) stock_movements (ledger)
    await addPurchaseStockMovements({
      transaction,
      purchaseId: purchaseRef.id,
      purchaseType: type,
      items: payload.items || [],
      supplierName: payload.supplierName || "",
      invoiceNo,
      documentDate: payload.documentDate || null,
      currency: "KZT",
    });

    // 2) stock_balances (official/actual ayrı weighted average)
    await applyPurchaseToStockBalances({
      transaction,
      purchaseType: type,
      items: payload.items || [],
    });

    // stok hareketleri sonra açılacak
    // await addPurchaseStockMovements(...)

    return purchaseRef.id;
  });
}
