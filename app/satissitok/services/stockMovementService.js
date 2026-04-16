import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import { buildProductSnapshot } from "./inventoryCatalogService";
import { writePurchaseCostEntries } from "./inventoryCostService";

const DEFAULT_WAREHOUSE_KEY = "main";

function text(value) {
  return String(value || "").trim();
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function safeWarehouseKey(value) {
  return text(value) || DEFAULT_WAREHOUSE_KEY;
}

function safeBucketKey(value) {
  return text(value) === "official" ? "official" : "actual";
}

function toDateValue(value) {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function getBucketState(docData, warehouseKey, bucketKey) {
  const whKey = safeWarehouseKey(warehouseKey);
  const whData = docData?.warehouses?.[whKey]?.[bucketKey];
  if (whData && (whData.qty !== undefined || whData.avgCost !== undefined)) {
    return {
      qty: num(whData.qty),
      avgCost: num(whData.avgCost),
    };
  }

  const legacy = docData?.[bucketKey] || {};
  return {
    qty: num(legacy.qty),
    avgCost: num(legacy.avgCost),
  };
}

function setBucketState({
  transaction,
  productId,
  warehouseKey,
  bucketKey,
  qty,
  avgCost,
}) {
  const ref = doc(db, "stock_balances", productId);
  transaction.set(
    ref,
    {
      warehouses: {
        [safeWarehouseKey(warehouseKey)]: {
          [safeBucketKey(bucketKey)]: {
            qty: round2(qty),
            avgCost: round2(avgCost),
            updatedAt: serverTimestamp(),
          },
        },
      },
    },
    { merge: true }
  );
}

function createMovementDoc({
  transaction,
  product,
  type,
  qty,
  warehouseKey,
  bucketKey,
  unitCost,
  totalCost,
  documentDate,
  note,
  referenceNo,
  relatedMovementId,
  counterpartyWarehouseKey,
}) {
  const ref = doc(collection(db, "stock_movements"));
  transaction.set(ref, {
    productId: product.id,
    productName: product.name || "",
    productSnapshot: buildProductSnapshot(product),
    unit: product.unit || "",
    qty: round2(qty),
    type,
    bucket: safeBucketKey(bucketKey),
    warehouseKey: safeWarehouseKey(warehouseKey),
    counterpartyWarehouseKey: counterpartyWarehouseKey || null,
    unitCost: round2(unitCost),
    totalCost: round2(totalCost),
    currency: "KZT",
    note: text(note) || null,
    referenceNo: text(referenceNo) || null,
    relatedMovementId: relatedMovementId || null,
    documentDate: toDateValue(documentDate),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export const STOCK_MOVEMENT_TYPES = [
  { key: "manual_in", label: "Manuel Giris" },
  { key: "manual_out", label: "Manuel Cikis" },
  { key: "transfer", label: "Depo Transferi" },
  { key: "count_adjustment", label: "Sayim Duzeltmesi" },
  { key: "wastage", label: "Fire / Zayiat" },
  { key: "opening_balance", label: "Acilis Bakiyesi" },
];

export async function createStockMovement(payload) {
  const movementType = text(payload?.movementType);

  if (!movementType) {
    throw new Error("Hareket tipi zorunlu");
  }

  return runTransaction(db, async (transaction) => {
    const productId = text(payload?.productId);
    if (!productId) {
      throw new Error("Urun secilmelidir");
    }

    const productRef = doc(db, "products", productId);
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error("Urun bulunamadi");
    }

    const product = { id: productSnap.id, ...productSnap.data() };
    const warehouseKey = safeWarehouseKey(payload?.warehouseKey);
    const bucketKey = safeBucketKey(payload?.bucketKey);
    const documentDate = payload?.documentDate || new Date().toISOString().slice(0, 10);
    const note = payload?.note || "";
    const referenceNo = payload?.referenceNo || "";
    const qty = round2(payload?.qty);
    const sourceBalanceRef = doc(db, "stock_balances", productId);
    const sourceBalanceSnap = await transaction.get(sourceBalanceRef);
    const sourceData = sourceBalanceSnap.exists() ? sourceBalanceSnap.data() : {};
    const sourceState = getBucketState(sourceData, warehouseKey, bucketKey);

    if (movementType === "manual_in" || movementType === "opening_balance") {
      if (!(qty > 0)) throw new Error("Miktar sifirdan buyuk olmali");
      const unitCost = round2(payload?.unitCost ?? sourceState.avgCost);
      const newQty = round2(sourceState.qty + qty);
      const newAvg =
        newQty > 0
          ? round2((sourceState.qty * sourceState.avgCost + qty * unitCost) / newQty)
          : 0;

      setBucketState({
        transaction,
        productId,
        warehouseKey,
        bucketKey,
        qty: newQty,
        avgCost: newAvg,
      });

      createMovementDoc({
        transaction,
        product,
        type: movementType,
        qty,
        warehouseKey,
        bucketKey,
        unitCost,
        totalCost: round2(qty * unitCost),
        documentDate,
        note,
        referenceNo,
      });

      writePurchaseCostEntries({
        transaction,
        purchaseId: `stock_${movementType}_${productId}`,
        purchaseType: bucketKey,
        supplierCariId: null,
        supplierName: movementType === "opening_balance" ? "Acilis" : "Manuel",
        invoiceNo: referenceNo || null,
        documentDate,
        warehouseKey,
        items: [
          {
            productId,
            productName: product.name || "",
            unit: product.unit || "",
            qty,
            unitPrice: unitCost,
            netUnitPrice: unitCost,
            grossUnitPrice: unitCost,
            grossLineTotal: round2(qty * unitCost),
            netLineTotal: round2(qty * unitCost),
            productSnapshot: buildProductSnapshot(product),
            priceSource: "manual",
          },
        ],
        entryType: movementType,
      });

      return true;
    }

    if (movementType === "manual_out" || movementType === "wastage") {
      if (!(qty > 0)) throw new Error("Miktar sifirdan buyuk olmali");
      if (sourceState.qty < qty) {
        throw new Error("Yetersiz stok");
      }

      setBucketState({
        transaction,
        productId,
        warehouseKey,
        bucketKey,
        qty: round2(sourceState.qty - qty),
        avgCost: sourceState.avgCost,
      });

      createMovementDoc({
        transaction,
        product,
        type: movementType,
        qty: -qty,
        warehouseKey,
        bucketKey,
        unitCost: sourceState.avgCost,
        totalCost: round2(qty * sourceState.avgCost),
        documentDate,
        note,
        referenceNo,
      });

      return true;
    }

    if (movementType === "transfer") {
      if (!(qty > 0)) throw new Error("Transfer miktari sifirdan buyuk olmali");
      if (sourceState.qty < qty) throw new Error("Transfer icin yeterli stok yok");

      const targetWarehouseKey = safeWarehouseKey(payload?.targetWarehouseKey);
      const targetBucketKey = safeBucketKey(payload?.targetBucketKey || bucketKey);
      const targetState = getBucketState(sourceData, targetWarehouseKey, targetBucketKey);

      setBucketState({
        transaction,
        productId,
        warehouseKey,
        bucketKey,
        qty: round2(sourceState.qty - qty),
        avgCost: sourceState.avgCost,
      });

      const targetQty = round2(targetState.qty + qty);
      const targetAvg =
        targetQty > 0
          ? round2(
              (targetState.qty * targetState.avgCost + qty * sourceState.avgCost) / targetQty
            )
          : sourceState.avgCost;

      setBucketState({
        transaction,
        productId,
        warehouseKey: targetWarehouseKey,
        bucketKey: targetBucketKey,
        qty: targetQty,
        avgCost: targetAvg,
      });

      const outId = createMovementDoc({
        transaction,
        product,
        type: "transfer_out",
        qty: -qty,
        warehouseKey,
        bucketKey,
        unitCost: sourceState.avgCost,
        totalCost: round2(qty * sourceState.avgCost),
        documentDate,
        note,
        referenceNo,
        counterpartyWarehouseKey: targetWarehouseKey,
      });

      createMovementDoc({
        transaction,
        product,
        type: "transfer_in",
        qty,
        warehouseKey: targetWarehouseKey,
        bucketKey: targetBucketKey,
        unitCost: sourceState.avgCost,
        totalCost: round2(qty * sourceState.avgCost),
        documentDate,
        note,
        referenceNo,
        relatedMovementId: outId,
        counterpartyWarehouseKey: warehouseKey,
      });

      return true;
    }

    if (movementType === "count_adjustment") {
      const targetQty = round2(payload?.targetQty);
      if (targetQty < 0) throw new Error("Sayim miktari negatif olamaz");

      const deltaQty = round2(targetQty - sourceState.qty);
      if (deltaQty === 0) {
        throw new Error("Mevcut stok ile sayim sonucu ayni");
      }

      if (deltaQty > 0) {
        const unitCost = round2(payload?.unitCost ?? sourceState.avgCost);
        const newQty = round2(sourceState.qty + deltaQty);
        const newAvg =
          newQty > 0
            ? round2((sourceState.qty * sourceState.avgCost + deltaQty * unitCost) / newQty)
            : 0;

        setBucketState({
          transaction,
          productId,
          warehouseKey,
          bucketKey,
          qty: newQty,
          avgCost: newAvg,
        });

        createMovementDoc({
          transaction,
          product,
          type: "count_surplus",
          qty: deltaQty,
          warehouseKey,
          bucketKey,
          unitCost,
          totalCost: round2(deltaQty * unitCost),
          documentDate,
          note,
          referenceNo,
        });
      } else {
        const absQty = Math.abs(deltaQty);
        if (sourceState.qty < absQty) throw new Error("Yetersiz stok");

        setBucketState({
          transaction,
          productId,
          warehouseKey,
          bucketKey,
          qty: round2(sourceState.qty - absQty),
          avgCost: sourceState.avgCost,
        });

        createMovementDoc({
          transaction,
          product,
          type: "count_shortage",
          qty: -absQty,
          warehouseKey,
          bucketKey,
          unitCost: sourceState.avgCost,
          totalCost: round2(absQty * sourceState.avgCost),
          documentDate,
          note,
          referenceNo,
        });
      }

      return true;
    }

    throw new Error("Desteklenmeyen stok hareket tipi");
  });
}
