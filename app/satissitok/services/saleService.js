// app/satissitok/services/saleService.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/firebase";

import {
  writeStockMovement,
  updateStockBalanceAfterSale,
  updateStockBalanceAfterReturn,
  getAverageCost,
} from "./stockService";

import {
  createCariTransaction,
} from "./cariService";

/**
 * saleType:
 * - "actual"   => KDV YOK, stok düşer
 * - "official" => KDV VAR, stok düşer
 *
 * Kurallar:
 * - Her satış cariye yazılır
 * - Maliyet = satış anındaki ortalama maliyet
 * - İptal / iade desteklenir
 */

// -------------------------
// Utils
// -------------------------
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

async function getNextSaleNumber(tx) {
  const counterRef = doc(db, "sale_counters", "main");
  const snap = await tx.get(counterRef);

  let next = 1;
  if (snap.exists()) {
    next = (snap.data().last || 0) + 1;
    tx.update(counterRef, { last: next });
  } else {
    tx.set(counterRef, { last: next });
  }

  return String(next).padStart(6, "0");
}

// -------------------------
// CREATE SALE
// -------------------------
export async function createSale({
  saleType,          // "actual" | "official"
  cariId,
  items,             // [{ productId, quantity, unitPrice, vatRate }]
  note = "",
}) {
  if (!saleType || !cariId || !items?.length) {
    throw new Error("Eksik satış bilgisi");
  }

  return await runTransaction(db, async (tx) => {
    const saleNo = await getNextSaleNumber(tx);
    const saleRef = doc(collection(db, "sales"));

    let netTotal = 0;
    let vatTotal = 0;
    let grossTotal = 0;

    const saleItems = [];

    for (const row of items) {
      const { productId, quantity, unitPrice, vatRate = 0 } = row;

      if (quantity <= 0) throw new Error("Miktar sıfır olamaz");

      // 🔴 Satış anındaki ortalama maliyet
      const avgCost = await getAverageCost(tx, productId, saleType);
      const costAtSale = round2(avgCost);

      const lineNet = round2(quantity * unitPrice);
      const lineVat =
        saleType === "official"
          ? round2(lineNet * (vatRate / 100))
          : 0;

      const lineTotal = round2(lineNet + lineVat);

      netTotal += lineNet;
      vatTotal += lineVat;
      grossTotal += lineTotal;

      saleItems.push({
        productId,
        quantity,
        unitPrice,
        vatRate: saleType === "official" ? vatRate : 0,
        net: lineNet,
        vat: lineVat,
        total: lineTotal,
        costAtSale,
      });
    }

    // 1️⃣ SALES
    tx.set(saleRef, {
      saleNo,
      saleType,
      cariId,
      netTotal: round2(netTotal),
      vatTotal: round2(vatTotal),
      grossTotal: round2(grossTotal),
      note,
      status: "completed",
      createdAt: serverTimestamp(),
    });

    // 2️⃣ SALE ITEMS + STOCK
    for (const item of saleItems) {
      const itemRef = doc(collection(saleRef, "items"));
      tx.set(itemRef, item);

      // stok düş
      await writeStockMovement(tx, {
        productId: item.productId,
        quantity: -item.quantity,
        type: "sale",
        refId: saleRef.id,
        cost: item.costAtSale,
        bucket: saleType,
      });

      await updateStockBalanceAfterSale(tx, {
        productId: item.productId,
        quantity: item.quantity,
        cost: item.costAtSale,
        bucket: saleType,
      });
    }

    // 3️⃣ CARI (zorunlu)
    await createCariTransaction(tx, {
      cariId,
      type: "debit", // müşteri borçlanır
      source: "sale",
      refId: saleRef.id,
      amount: round2(grossTotal),
    });

    return {
      saleId: saleRef.id,
      saleNo,
    };
  });
}

// -------------------------
// CANCEL SALE
// -------------------------
export async function cancelSale({ saleId, reason = "" }) {
  if (!saleId) throw new Error("saleId gerekli");

  return await runTransaction(db, async (tx) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await tx.get(saleRef);

    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") {
      throw new Error("Bu satış zaten iptal edilmiş");
    }

    const itemsSnap = await getDocs(
      collection(db, "sales", saleId, "items")
    );

    // stok geri ekle
    for (const docSnap of itemsSnap.docs) {
      const item = docSnap.data();

      await writeStockMovement(tx, {
        productId: item.productId,
        quantity: item.quantity,
        type: "sale_cancel",
        refId: saleId,
        cost: item.costAtSale,
        bucket: sale.saleType,
      });

      await updateStockBalanceAfterReturn(tx, {
        productId: item.productId,
        quantity: item.quantity,
        bucket: sale.saleType,
      });
    }

    // cari ters kayıt
    await createCariTransaction(tx, {
      cariId: sale.cariId,
      type: "credit",
      source: "sale_cancel",
      refId: saleId,
      amount: sale.grossTotal,
    });

    tx.update(saleRef, {
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: serverTimestamp(),
    });

    return { ok: true };
  });
}

// -------------------------
// RETURN SALE (IADE)
// -------------------------
export async function returnSale({ saleId, reason = "" }) {
  if (!saleId) throw new Error("saleId gerekli");

  return await runTransaction(db, async (tx) => {
    const saleRef = doc(db, "sales", saleId);
    const saleSnap = await tx.get(saleRef);

    if (!saleSnap.exists()) throw new Error("Satış bulunamadı");

    const sale = saleSnap.data();
    if (sale.status !== "completed") {
      throw new Error("İade edilemez durumda");
    }

    const itemsSnap = await getDocs(
      collection(db, "sales", saleId, "items")
    );

    for (const docSnap of itemsSnap.docs) {
      const item = docSnap.data();

      await writeStockMovement(tx, {
        productId: item.productId,
        quantity: item.quantity,
        type: "sale_return",
        refId: saleId,
        cost: item.costAtSale,
        bucket: sale.saleType,
      });

      await updateStockBalanceAfterReturn(tx, {
        productId: item.productId,
        quantity: item.quantity,
        bucket: sale.saleType,
      });
    }

    await createCariTransaction(tx, {
      cariId: sale.cariId,
      type: "credit",
      source: "sale_return",
      refId: saleId,
      amount: sale.grossTotal,
    });

    tx.update(saleRef, {
      status: "returned",
      returnReason: reason,
      returnedAt: serverTimestamp(),
    });

    return { ok: true };
  });
}
