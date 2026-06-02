"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/firebase";

const COLLECTION_NAME = "commercial_offers";

function text(value) {
  return String(value ?? "").trim();
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

export function getStorageImageUrl(imageName) {
  const fileName = text(imageName);
  if (!fileName) return "";
  return `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/product_images%2F${encodeURIComponent(fileName)}?alt=media`;
}

export function buildOfferItemFromProduct(product = {}, defaultUnit = "шт") {
  const imageName = array(product.image_names).find(Boolean) || "";
  const featureLines = [text(product.dimensions), text(product.material), text(product.description)]
    .filter(Boolean)
    .slice(0, 3);

  return {
    rowId: `${text(product.id || product.stock_code || Date.now())}_${Math.random().toString(36).slice(2, 8)}`,
    productId: text(product.id || product.stock_code),
    sku: text(product.sku || product.stock_code || product.id),
    brand: text(product.brand),
    imageUrl: getStorageImageUrl(imageName),
    imageName,
    name: text(product.name || product.name_ru || product.name_tr || "Товар"),
    description: text(featureLines.join("\n")),
    quantity: 1,
    unit: text(product.unit || defaultUnit || "шт"),
    unitPrice: number(product.price),
  };
}

export function calculateOfferTotals(items = [], vatRate = 12) {
  const normalizedItems = array(items).map((item, index) => {
    const quantity = number(item.quantity);
    const unitPrice = number(item.unitPrice);
    const lineTotal = quantity * unitPrice;

    return {
      ...item,
      rowId: text(item.rowId || item.productId || `row_${index + 1}`),
      quantity,
      unitPrice,
      lineTotal,
    };
  });

  const grandTotal = normalizedItems.reduce((sum, item) => sum + number(item.lineTotal), 0);
  const vatAmount = vatRate > 0 ? grandTotal - grandTotal / (1 + vatRate / 100) : 0;

  return {
    items: normalizedItems,
    totals: {
      grandTotal,
      vatRate: number(vatRate, 12),
      vatAmount,
    },
  };
}

function normalizeLines(value, fallback = []) {
  const lines = array(value)
    .map((item) => text(item))
    .filter(Boolean);
  return lines.length ? lines : fallback;
}

export function buildDefaultOfferPayload({
  offerNo = "",
  sequence = 0,
  units = [],
  vatRate = 12,
} = {}) {
  const defaultUnit = array(units).find((item) => item.default)?.label || array(units)[0]?.label || "шт";

  return {
    offerNo,
    sequence,
    status: "draft",
    issueDate: new Date().toISOString().slice(0, 10),
    validDays: 7,
    currency: "KZT",
    vatRate,
    seller: {
      brandName: "HorecaLink",
      tagline: "Профессиональное оборудование и изделия из нержавеющей стали для HoReCa",
      companyName: "ТОО «Viroo Trade»",
      bin: "151240008450",
      address: "Республика Казахстан, г. Алматы, ул. Черноморская, дом 12",
      bankDetails:
        "Реквизиты поставщика: ТОО «Viroo Trade» | БИН 151240008450 | ИИК KZ89722S000006588517 | АО «KASPI BANK» | БИК CASPKZKA | Кбе 17 | Тел.: +7 702 394 01 82 | Директор: Гюнай Хасан Али",
      signatureName: "HorecaLink",
      signatureSubtitle: "официальный поставщик: ТОО «Viroo Trade»",
    },
    buyer: {
      companyName: "",
      bin: "",
      address: "",
      contactName: "",
      phone: "",
      email: "",
      cariId: "",
    },
    introText:
      "Компания HorecaLink направляет коммерческое предложение на поставку профессиональных изделий из нержавеющей стали. Официальное оформление, счет на оплату и бухгалтерские документы предоставляются от имени ТОО «Viroo Trade».",
    priceNote: "Цены указаны в тенге, с учетом НДС 12%.",
    terms: {
      delivery: normalizeLines([], [
        "Срок изготовления / поставки: по согласованию.",
        "Доставка по г. Алматы: по договоренности.",
        "Доставка в регионы РК: через транспортные компании.",
      ]),
      payment: normalizeLines([], [
        "Оплата производится на расчетный счет ТОО «Viroo Trade».",
        "Основанием для оплаты является счет на оплату.",
        "Возможна предоплата или иные согласованные условия.",
      ]),
      warranty: normalizeLines([], [
        "Гарантия распространяется на производственные дефекты.",
        "Все размеры и характеристики согласовываются перед запуском в производство.",
      ]),
    },
    items: [
      {
        rowId: "row_1",
        productId: "",
        sku: "",
        brand: "",
        imageUrl: "",
        imageName: "",
        name: "",
        description: "",
        quantity: 1,
        unit: defaultUnit,
        unitPrice: 0,
      },
    ],
    totals: {
      grandTotal: 0,
      vatRate,
      vatAmount: 0,
    },
  };
}

export async function getNextCommercialOfferMeta() {
  const snap = await getDocs(
    query(collection(db, COLLECTION_NAME), orderBy("sequence", "desc"), limit(1))
  );
  const lastSequence = snap.docs[0]?.data()?.sequence || 0;
  const nextSequence = number(lastSequence) + 1;
  return {
    sequence: nextSequence,
    offerNo: `HL-${nextSequence}`,
  };
}

export async function listCommercialOffers() {
  const snap = await getDocs(
    query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"))
  );

  return snap.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getCommercialOffer(offerId) {
  const ref = doc(db, COLLECTION_NAME, offerId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
  };
}

export async function createCommercialOffer(payload) {
  const ref = await addDoc(collection(db, COLLECTION_NAME), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function saveCommercialOffer(offerId, payload) {
  const ref = doc(db, COLLECTION_NAME, offerId);
  await setDoc(
    ref,
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
