// app/satissitok/services/saleService.js
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  readStockBalancesForSale,
  writeSaleStockMovements,
  writeStockBalancesAfterSale,
  writeStockBalancesAfterReturn,
} from "./stockService";

import { reserveNextDraftNo, reserveNextInvoiceNo } from "./invoiceCounterService";
import { createCariTransaction } from "@/app/satissitok/admin/cari/services/cariService";

export async function createSale(payload) {
  return await runTransaction(db, async (transaction) => {
    const saleType = payload?.saleType === "actual" ? "actual" : "official";
    const saleChannel = (payload?.saleChannel || payload?.platformId || "other").trim();
    const cariId = payload?.cariId || null;
    const status = ["draft", "pending", "completed"].includes(payload?.status)
      ? payload.status
      : payload?.processStatus === "completed"
      ? "completed"
      : payload?.processStatus === "pending"
      ? "pending"
      : "draft";
    const isFinal = status === "completed";

    const payment = payload?.payment || {};
    const paymentMethod = (payment.method || payload?.paymentMethod || "").trim();
    const paidAmount = Number(payment.paidAmount ?? payload?.paidAmount ?? 0) || 0;
    const invoiceDateISO = payload?.invoiceDate || new Date().toISOString().slice(0, 10);
    const manualInvoice = (payload?.invoiceNo || payload?.docNo || "").trim();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    const saleRef = payload?.saleId ? doc(db, "sales", payload.saleId) : doc(collection(db, "sales"));

    const existingSnap = payload?.saleId ? await transaction.get(saleRef) : null;
    const existing = existingSnap?.exists() ? existingSnap.data() : null;
    if (existing?.status === "completed") {
      throw new Error("Tamamlanmış satış taslak olarak güncellenemez.");
    }

    const existingBalances = isFinal
      ? await readStockBalancesForSale({ transaction, items, saleType })
      : {};

    const negativeStockItems = [];
    if (isFinal) {
      const soldByKey = {};
      for (const it of items) {
        if (!it?.productId) continue;
        const whKey = (it.warehouseKey || "main").trim() || "main";
        const q = Number(it.quantity || 0);
        if (!q) continue;
        const k = `${it.productId}__${whKey}`;
        soldByKey[k] = (soldByKey[k] || 0) + q;
      }
      for (const [compoundKey, sold] of Object.entries(soldByKey)) {
        const [productId, warehouseKey] = compoundKey.split("__");
        const available = Number(existingBalances?.[compoundKey]?.qty || 0);
        if (available < sold) negativeStockItems.push({ productId, warehouseKey, available, sold });
      }
    }

    let invoiceNo = manualInvoice || null;
    let invoiceSequence = existing?.invoiceSequence || null;
    let invoiceYear2 = existing?.invoiceYear2 || null;
    let invoiceCounterRef = existing?.invoiceCounterRef || null;
    let draftNo = existing?.draftNo || null;
    let draftSequence = existing?.draftSequence || null;
    let draftYear2 = existing?.draftYear2 || null;
    let draftCounterRef = existing?.draftCounterRef || null;
    let invoiceNoAuto = null;
    let invoiceNoManual = Boolean(manualInvoice);

    if (isFinal) {
      const reserved = await reserveNextInvoiceNo({
        transaction,
        kind: "sales",
        type: saleType,
        dateISO: invoiceDateISO,
      });
      invoiceNo = payload?.invoiceNoAuto === true ? reserved.autoInvoice : manualInvoice || reserved.autoInvoice;
      invoiceSequence = reserved.nextSeq;
      invoiceYear2 = reserved.yy;
      invoiceCounterRef = reserved.counterRefPath;
      invoiceNoAuto = invoiceNo === reserved.autoInvoice ? reserved.autoInvoice : null;
      invoiceNoManual = invoiceNo !== reserved.autoInvoice;
    } else {
      if (!draftNo) {
        const reservedDraft = await reserveNextDraftNo({ transaction, kind: "sales", dateISO: invoiceDateISO });
        draftNo = reservedDraft.draftNo;
        draftSequence = reservedDraft.nextSeq;
        draftYear2 = reservedDraft.yy;
        draftCounterRef = reservedDraft.counterRefPath;
      }
      invoiceNo = draftNo;
      invoiceSequence = null;
      invoiceYear2 = draftYear2;
      invoiceCounterRef = draftCounterRef;
      invoiceNoAuto = draftNo;
      invoiceNoManual = false;
    }

    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;
    let costTotalUsed = 0;
    let profitTotal = 0;

    if (isFinal) {
      const itemsCol = collection(db, "sales", saleRef.id, "items");
      for (const row of items) {
        if (!row?.productId) continue;
        const quantity = Number(row.quantity || 0);
        if (quantity <= 0) continue;
        const unitPrice = Number(row.unitPrice || 0);
        const discountRate = Number(row.discountRate || 0);
        const net = Number(row.net || 0);
        const vat = Number(row.vat || 0);
        const total = Number(row.total || 0);
        netTotal += net;
        vatTotal += vat;
        grossTotal += total;
        const whKey = (row.warehouseKey || "main").trim() || "main";
        const balKey = `${row.productId}__${whKey}`;
        const avgCost = Number(existingBalances?.[balKey]?.avgCost || 0);
        const lineCost = Math.round(quantity * avgCost * 100) / 100;
        const lineProfit = Math.round((net - lineCost) * 100) / 100;
        costTotalUsed += lineCost;
        profitTotal += lineProfit;
        transaction.set(doc(itemsCol), {
          productId: row.productId,
          productName: row.productName || "",
          unit: row.unit || "",
          warehouseKey: whKey,
          quantity,
          unitPrice,
          discountRate,
          vatRate: saleType === "official" ? Number(row.vatRate || 0) : 0,
          net,
          vat: saleType === "official" ? vat : 0,
          total,
          costAtSale: avgCost,
          lineCost,
          profit: lineProfit,
        });
      }
    } else {
      netTotal = Number(payload?.totals?.net || 0) || 0;
      vatTotal = Number(payload?.totals?.vat || payload?.totals?.tax || 0) || 0;
      grossTotal = Number(payload?.totals?.total || payload?.totals?.gross || 0) || 0;
    }

    netTotal = Math.round(netTotal * 100) / 100;
    vatTotal = Math.round(vatTotal * 100) / 100;
    grossTotal = Math.round(grossTotal * 100) / 100;
    costTotalUsed = Math.round(costTotalUsed * 100) / 100;
    profitTotal = Math.round(profitTotal * 100) / 100;

    const ratesUsed = Array.from(new Set((items || []).filter((x) => x?.productId).map((x) => Number(x.vatRate || 0))));
    const saleVatRate = saleType === "official" && ratesUsed.length === 1 ? ratesUsed[0] : null;

    transaction.set(
      saleRef,
      {
        saleNo: invoiceNo,
        saleType,
        saleChannel,
        platformId: saleChannel,
        invoiceNo,
        invoiceNoAuto: invoiceNoAuto || null,
        invoiceNoManual,
        invoiceSequence,
        invoiceYear2,
        invoiceCounterRef,
        draftNo,
        draftSequence,
        draftYear2,
        draftCounterRef,
        isDraftLike: !isFinal,
        approvedAt: isFinal ? serverTimestamp() : null,
        finalizedAt: isFinal ? serverTimestamp() : null,
        cariId: cariId || null,
        vatRate: saleType === "official" ? saleVatRate : 0,
        vatRatesUsed: saleType === "official" ? ratesUsed : [],
        vatMode: saleType === "official" ? (payload?.vatMode || "exclude") : null,
        payment: {
          method: paymentMethod || null,
          paidAmount: paidAmount > 0 ? Math.round(paidAmount * 100) / 100 : 0,
          isPaid: Boolean(payment.isPaid),
        },
        netTotal,
        vatTotal: saleType === "official" && isFinal ? vatTotal : 0,
        grossTotal,
        costTotalUsed,
        profitTotal,
        hasNegativeStock: isFinal && negativeStockItems.length > 0,
        negativeStockItems,
        status,
        invoiceDate: invoiceDateISO ? new Date(invoiceDateISO) : null,
        documentDate: invoiceDateISO ? new Date(invoiceDateISO) : null,
        dueDate: payload?.dueDate ? new Date(payload.dueDate) : null,
        meta: payload?.meta || null,
        draftItems: !isFinal ? items : null,
        createdAt: existing ? existing.createdAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (isFinal) {
      const itemsForStock = items
        .filter((r) => r?.productId && Number(r.quantity || 0) > 0)
        .map((r) => ({
          ...r,
          warehouseKey: (r.warehouseKey || "main").trim() || "main",
          costAtSale: Number(existingBalances?.[`${r.productId}__${((r.warehouseKey || "main").trim() || "main")}`]?.avgCost || 0),
        }));

      writeSaleStockMovements({
        transaction,
        saleId: saleRef.id,
        saleType,
        items: itemsForStock,
        saleChannel,
        invoiceNo,
        invoiceDate: invoiceDateISO,
      });

      writeStockBalancesAfterSale({
        transaction,
        saleType,
        items: itemsForStock,
        existingBalances,
      });

      if (cariId) {
        createCariTransaction(transaction, {
          cariId,
          type: "debit",
          source: "sale",
          refId: saleRef.id,
          amount: grossTotal,
          operationDate: invoiceDateISO,
          currency: "KZT",
          note: `Satış faturası: ${invoiceNo}`,
        });

        if (paidAmount > 0) {
          createCariTransaction(transaction, {
            cariId,
            type: "credit",
            source: "sale_payment",
            refId: saleRef.id,
            amount: paidAmount,
            operationDate: invoiceDateISO,
            currency: "KZT",
            paymentMethod: paymentMethod || null,
            note: `Tahsilat (${paymentMethod || ""}) - ${invoiceNo}`,
          });
        }
      }
    }

    return { saleId: saleRef.id };
  });
}

export async function deleteSaleDraft({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");
  const ref = doc(db, "sales", saleId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Taslak bulunamadı");
  const data = snap.data();
  if (data.status === "completed") throw new Error("Tamamlanmış satış kaydı silinemez.");
  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  await Promise.all(itemsSnap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(ref);
  return true;
}

export async function cancelSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");
  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");
    const sale = saleSnap.data();
    if (sale.status !== "completed") {
      transaction.set(saleRef, { status: "cancelled", updatedAt: serverTimestamp() }, { merge: true });
      return;
    }
    const saleType = sale.saleType === "actual" ? "actual" : "official";
    const existingBalances = await readStockBalancesForSale({ transaction, items, saleType });
    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      existingBalances,
    });
    transaction.set(saleRef, { status: "cancelled", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  });
}

export async function returnSale({ saleId }) {
  if (!saleId) throw new Error("saleId gerekli");
  const itemsSnap = await getDocs(collection(db, "sales", saleId, "items"));
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await transaction.get(saleRef);
    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");
    const sale = saleSnap.data();
    if (sale.status !== "completed") return;
    const saleType = sale.saleType === "actual" ? "actual" : "official";
    const existingBalances = await readStockBalancesForSale({ transaction, items, saleType });
    writeStockBalancesAfterReturn({
      transaction,
      saleType,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      existingBalances,
    });
    transaction.set(saleRef, { status: "returned", returnedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  });
}
