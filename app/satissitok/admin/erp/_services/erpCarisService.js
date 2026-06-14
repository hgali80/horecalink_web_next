"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/firebase";
import { ERP_COLLECTIONS } from "./erpCollections";
import { formatErpDate, listErpDocuments } from "./erpDocumentsService";

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

function formatDate(value) {
  if (!value) return "-";
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
          ? new Date(value.seconds * 1000)
          : new Date(value);

    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("tr-TR");
  } catch {
    return "-";
  }
}

function resolveSortTime(value) {
  if (!value) return 0;
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value?.seconds
        ? new Date(value.seconds * 1000)
        : new Date(value);
  const time = date?.getTime?.() ?? 0;
  return Number.isFinite(time) ? time : 0;
}

function normalizeCariType(data = {}) {
  const customer = data.isCustomer === true || text(data.type).toLowerCase() === "customer";
  const supplier = data.isSupplier === true || text(data.type).toLowerCase() === "supplier";
  const both = data.isCustomer === true && data.isSupplier === true;

  if (both) return "musteri + tedarikci";
  if (customer) return "musteri";
  if (supplier) return "tedarikci";
  return "genel";
}

function normalizeBankAccount(account = {}) {
  return {
    bankName: text(account.bankName),
    bik: text(account.bik),
    iban: text(account.iban),
    notes: text(account.notes),
  };
}

function normalizeBankAccounts(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map(normalizeBankAccount)
    .filter((item) => item.bankName || item.bik || item.iban || item.notes);
}

export async function listErpCaris() {
  const snap = await getDocs(collection(db, ERP_COLLECTIONS.CARIS));
  const rows = snap.docs.map((item) => {
    const data = item.data() || {};
    const balance = data.balanceSummary || {};
    return {
      id: item.id,
      code: text(data.code || data.cariCode),
      name: text(data.name || data.companyName || data.title),
      shortName: text(data.shortName),
      bin: text(data.bin || data.taxNo),
      kbe: text(data.kbe),
      legalAddress: text(data.legalAddress || data.address),
      directorName: text(data.directorName),
      phone: text(data.phone || data.mobile),
      email: text(data.email),
      typeLabel: normalizeCariType(data),
      isActive: data.active !== false,
      receivable: num(balance.receivable, num(data.receivable, 0)),
      payable: num(balance.payable, num(data.payable, 0)),
      updatedLabel: formatDate(data.updatedAt || data.createdAt),
      updatedTime: resolveSortTime(data.updatedAt || data.createdAt),
    };
  });

  rows.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.updatedTime - a.updatedTime;
  });

  return rows;
}

export async function listErpCariOptions() {
  const rows = await listErpCaris();
  return rows
    .filter((item) => item.name)
    .map((item) => ({
      value: item.id,
      label: item.code ? `${item.name} (${item.code})` : item.name,
      name: item.name,
      typeLabel: item.typeLabel,
      isActive: item.isActive,
    }));
}

export async function getErpCari(cariId) {
  const ref = doc(db, ERP_COLLECTIONS.CARIS, cariId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Cari kaydi bulunamadi.");
  }

  return normalizeCariDetail({ id: snap.id, ...(snap.data() || {}) });
}

export async function saveErpCari(payload = {}) {
  const normalized = normalizeCariPayload(payload);
  const ref = normalized.id
    ? doc(db, ERP_COLLECTIONS.CARIS, normalized.id)
    : doc(collection(db, ERP_COLLECTIONS.CARIS));

  await setDoc(
    ref,
    {
      code: normalized.code,
      name: normalized.name,
      shortName: normalized.shortName,
      bin: normalized.bin,
      kbe: normalized.kbe,
      phone: normalized.phone,
      email: normalized.email,
      taxNo: normalized.taxNo,
      taxOffice: normalized.taxOffice,
      address: normalized.address,
      legalAddress: normalized.legalAddress,
      directorName: normalized.directorName,
      bankAccounts: normalized.bankAccounts,
      notes: normalized.notes,
      active: normalized.active,
      isCustomer: normalized.isCustomer,
      isSupplier: normalized.isSupplier,
      currency: normalized.currency,
      balanceSummary: {
        receivable: normalized.openingReceivable,
        payable: normalized.openingPayable,
      },
      updatedAt: serverTimestamp(),
      createdAt: normalized.createdAt || serverTimestamp(),
    },
    { merge: true }
  );

  return {
    id: ref.id,
    ...normalized,
  };
}

export async function getErpCariDashboard(cariId) {
  const [cari, sales, purchases, cariMovements] = await Promise.all([
    getErpCari(cariId),
    listErpDocuments(ERP_COLLECTIONS.SALES),
    listErpDocuments(ERP_COLLECTIONS.PURCHASES),
    listErpCariMovementEntries(cariId),
  ]);

  const allDocs = [
    ...sales.map((item) => ({ ...item, documentKind: "sales" })),
    ...purchases.map((item) => ({ ...item, documentKind: "purchases" })),
  ]
    .filter((item) => item.cariId === cariId || text(item?.cariSnapshot?.id) === cariId)
    .sort((a, b) => b.sortTime - a.sortTime);

  const openDocuments = allDocs.filter((item) =>
    ["open", "partial"].includes(text(item.paymentStatus).toLowerCase())
  );

  return {
    cari,
    documents: allDocs,
    openDocuments,
    cashMovements: cariMovements,
    summary: {
      openDocumentCount: openDocuments.length,
      totalSales: round2(
        allDocs
          .filter((item) => item.kind === "sales" || item.documentKind === "sales")
          .reduce((sum, item) => sum + num(item.totalAmount, 0), 0)
      ),
      totalPurchases: round2(
        allDocs
          .filter((item) => item.kind === "purchases" || item.documentKind === "purchases")
          .reduce((sum, item) => sum + num(item.totalAmount, 0), 0)
      ),
      movementCount: cariMovements.length,
    },
  };
}

export async function listErpCariMovementEntries(cariId) {
  const snap = await getDocs(collection(db, ERP_COLLECTIONS.CARI_MOVEMENTS));
  const rows = snap.docs
    .map((item) => {
      const data = item.data() || {};
      return {
        id: item.id,
        cariId: text(data.cariId),
        cariName: text(data.cariName),
        direction: text(data.direction || "alacak"),
        kind: text(data.movementKind || "manual"),
        amount: round2(data.amount),
        currency: text(data.currency || "KZT"),
        accountName: text(data.accountName),
        method: text(data.method),
        receiptNo: text(data.receiptNo),
        documentNo: text(data.documentNo),
        notes: text(data.notes),
        dateLabel: formatErpDate(data.movementDate || data.createdAt),
        sortTime: resolveSortTime(data.movementDate || data.createdAt),
      };
    })
    .filter((item) => item.cariId === cariId);

  rows.sort((a, b) => b.sortTime - a.sortTime);
  return rows;
}

function normalizeCariPayload(payload = {}) {
  return {
    id: text(payload.id),
    code: text(payload.code),
    name: text(payload.name),
    shortName: text(payload.shortName),
    bin: text(payload.bin || payload.taxNo),
    kbe: text(payload.kbe),
    phone: text(payload.phone),
    email: text(payload.email),
    taxNo: text(payload.taxNo),
    taxOffice: text(payload.taxOffice),
    address: text(payload.address),
    legalAddress: text(payload.legalAddress || payload.address),
    directorName: text(payload.directorName),
    bankAccounts: normalizeBankAccounts(payload.bankAccounts),
    notes: text(payload.notes),
    active: payload.active !== false,
    isCustomer: payload.isCustomer === true,
    isSupplier: payload.isSupplier === true,
    currency: text(payload.currency || "KZT"),
    openingReceivable: num(payload.openingReceivable, 0),
    openingPayable: num(payload.openingPayable, 0),
    createdAt: payload.createdAt || null,
  };
}

function normalizeCariDetail(data = {}) {
  const balance = data.balanceSummary || {};
  return {
    id: text(data.id),
    code: text(data.code),
    name: text(data.name || data.companyName || data.title),
    shortName: text(data.shortName),
    bin: text(data.bin || data.taxNo),
    kbe: text(data.kbe),
    phone: text(data.phone || data.mobile),
    email: text(data.email),
    taxNo: text(data.taxNo),
    taxOffice: text(data.taxOffice),
    address: text(data.address),
    legalAddress: text(data.legalAddress || data.address),
    directorName: text(data.directorName),
    bankAccounts: normalizeBankAccounts(data.bankAccounts),
    notes: text(data.notes),
    active: data.active !== false,
    isCustomer: data.isCustomer === true,
    isSupplier: data.isSupplier === true,
    currency: text(data.currency || "KZT"),
    openingReceivable: num(balance.receivable, num(data.receivable, 0)),
    openingPayable: num(balance.payable, num(data.payable, 0)),
    createdAt: data.createdAt || null,
  };
}
