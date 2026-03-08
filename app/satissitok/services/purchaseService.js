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

import { reserveNextInvoiceNo } from "./invoiceCounterService";

function toDateOrNull(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

/* =========================================================
   CREATE / SAVE PURCHASE
   - status=draft    => sadece belge taslağı kaydedilir
   - status=completed => stok / cari / sayaç yazılır
========================================================= */

export async function createPurchase(payload) {
  return await runTransaction(db, async (transaction) => {
    const type = payload.purchaseType;
    if (type !== "official" && type !== "actual") {
      throw new Error("purchaseType geçersiz: official | actual olmalı");
    }

    const status = (payload.status || "completed").trim() || "completed";
    const isDraft = status === "draft";
    const isFinal = status === "completed";
    const draftId = (payload?.draftId || "").trim() || null;

    const warehouseKey = (payload.warehouseKey || "main").trim() || "main";
    const manualInvoice = (payload.invoiceNo ?? payload.documentNo ?? "").trim();
    const invoiceNoAutoFlag = payload.invoiceNoAuto === true;
    const items = Array.isArray(payload.items) ? payload.items : [];

    const purchaseRef = draftId ? doc(db, "purchases", draftId) : doc(collection(db, "purchases"));
    const existingSnap = draftId ? await transaction.get(purchaseRef) : null;
    const existingData = existingSnap?.exists() ? existingSnap.data() : null;
    const createdAtValue = existingData?.createdAt || serverTimestamp();

    const t = payload.totals || {};
    const net = round2(t.net ?? payload.netTotal ?? 0);
    const vatRaw = t.tax ?? t.vat ?? payload.vatTotal ?? payload.taxTotal ?? 0;
    const vat = round2(vatRaw);
    const gross = round2(t.gross ?? payload.grossTotal ?? payload.total ?? (net + vat));

    if (isDraft) {
      transaction.set(
        purchaseRef,
        {
          supplierName: (payload.supplierName || "").trim(),
          supplierCariId: payload.supplierCariId || null,
          supplierBin: (payload.supplierBin || "").trim(),
          supplierRef: (payload.supplierRef || "").trim(),
          responsiblePerson: (payload.responsiblePerson || "").trim(),
          invoiceNo: manualInvoice || null,
          documentNo: manualInvoice || null,
          invoiceNoAuto: null,
          invoiceNoManual: Boolean(manualInvoice),
          invoiceSequence: null,
          invoiceYear2: null,
          invoiceCounterRef: null,
          documentDate: toDateOrNull(payload.documentDate),
          purchaseType: type,
          warehouseKey,
          taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
          vatMode: type === "official" ? payload.vatMode || "inclusive" : null,
          items,
          totals: {
            net,
            tax: vat,
            vat,
            gross,
          },
          netTotal: net,
          vatTotal: type === "official" ? vat : 0,
          grossTotal: gross,
          paymentMethod: (payload.paymentMethod || "").trim(),
          payment: payload.payment || null,
          dueDate: toDateOrNull(payload.dueDate),
          notes: (payload.notes || "").trim(),
          attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
          status: "draft",
          draftSavedAt: serverTimestamp(),
          createdAt: createdAtValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return purchaseRef.id;
    }

    const existingBalances = isFinal
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    const { yy, nextSeq, autoInvoice } = await reserveNextInvoiceNo({
      transaction,
      kind: "purchases",
      type,
      dateISO: payload.documentDate,
    });

    const invoiceNo = invoiceNoAutoFlag ? autoInvoice : manualInvoice || autoInvoice;
    const invoiceNoAutoValue = invoiceNo === autoInvoice ? autoInvoice : null;
    const invoiceNoManual = invoiceNo !== autoInvoice;
    const vatTotal = type === "official" ? vat : 0;

    const totalsNormalized = {
      net,
      tax: vat,
      vat,
      gross,
    };

    transaction.set(
      purchaseRef,
      {
        supplierName: (payload.supplierName || "").trim(),
        supplierCariId: payload.supplierCariId || null,
        supplierBin: (payload.supplierBin || "").trim(),
        supplierRef: (payload.supplierRef || "").trim(),
        responsiblePerson: (payload.responsiblePerson || "").trim(),
        invoiceNo,
        documentNo: invoiceNo,
        invoiceNoAuto: invoiceNoAutoValue,
        invoiceNoManual,
        invoiceSequence: nextSeq,
        invoiceYear2: yy,
        invoiceCounterRef: "invoice_counters/purchases",
        documentDate: toDateOrNull(payload.documentDate),
        purchaseType: type,
        warehouseKey,
        taxRate: type === "official" ? Number(payload.taxRate || 0) : 0,
        vatMode: type === "official" ? payload.vatMode || "inclusive" : null,
        items,
        totals: totalsNormalized,
        netTotal: net,
        vatTotal,
        grossTotal: gross,
        paymentMethod: (payload.paymentMethod || "").trim(),
        payment: payload.payment || null,
        dueDate: toDateOrNull(payload.dueDate),
        notes: (payload.notes || "").trim(),
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        status,
        draftSavedAt: null,
        createdAt: createdAtValue,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (isFinal) {
      writePurchaseStockMovements({
        transaction,
        purchaseId: purchaseRef.id,
        purchaseType: type,
        items,
        supplierName: (payload.supplierName || "").trim(),
        invoiceNo,
        documentDate: payload.documentDate || null,
        currency: "KZT",
        warehouseKey,
      });

      writeStockBalancesWithAvgCost({
        transaction,
        purchaseType: type,
        items,
        existingBalances,
        warehouseKey,
      });
    }

    if (isFinal && payload.supplierCariId) {
      const desc = (payload.description || payload.notes || "Satınalma faturası").trim();
      const cariTxRef = doc(collection(db, "cari_transactions"));

      transaction.set(cariTxRef, {
        cariId: payload.supplierCariId,
        operationDate: toDateOrNull(payload.documentDate),
        dueDate: toDateOrNull(payload.dueDate),
        operationType: "purchase_invoice",
        direction: "credit",
        amount: gross,
        refId: purchaseRef.id,
        documentNo: invoiceNo,
        note: desc,
        paymentMethod: (payload.paymentMethod || "").trim() || null,
        operationCategory: payload.operationCategory || "trade_goods",
        currency: "KZT",
        debit: 0,
        credit: gross,
        description: desc,
        source: "purchase",
        createdAt: serverTimestamp(),
      });
    }

    return purchaseRef.id;
  });
}

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

    const wasFinal = purchase.status === "completed";

    const existingBalances = wasFinal
      ? await readStockBalancesForPurchase({
          transaction,
          items,
        })
      : null;

    if (wasFinal) {
      writePurchaseStockMovements({
        transaction,
        purchaseId: purchaseRef.id,
        purchaseType: type,
        items,
        supplierName: purchase.supplierName || "",
        invoiceNo: purchase.invoiceNo,
        documentDate: purchase.documentDate || null,
        currency: "KZT",
        warehouseKey: purchase.warehouseKey || "main",
        reverse: true,
      });

      writeStockBalancesWithAvgCost({
        transaction,
        purchaseType: type,
        items,
        existingBalances,
        warehouseKey: purchase.warehouseKey || "main",
        reverse: true,
      });

      if (purchase.supplierCariId) {
        const gross = Number(purchase.grossTotal ?? purchase.totals?.gross ?? 0);
        const desc = "Satınalma faturası iptali";

        const cariTxRef = doc(collection(db, "cari_transactions"));

        transaction.set(cariTxRef, {
          cariId: purchase.supplierCariId,
          operationDate: new Date(),

          // canonical
          operationType: "purchase_cancel",
          direction: "debit",
          amount: gross,
          refId: purchaseId,
          documentNo: purchase.invoiceNo,
          note: desc,
          currency: "KZT",

          // legacy
          debit: gross,
          credit: 0,
          description: desc,
          source: "purchase_cancel",

          createdAt: serverTimestamp(),
        });
      }
    }

    transaction.update(purchaseRef, {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return true;
  });
}