//app/services/quoteService.js
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
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

const COLLECTION_NAME = "quote_requests";
const GUEST_QUOTES_STORAGE_KEY = "horecalink_guest_quotes";

export const QUOTE_STATUSES = {
  draft: { key: "draft", label: "Taslak" },
  new: { key: "new", label: "Yeni Talep" },
  reviewing: { key: "reviewing", label: "İnceleniyor" },
  priced: { key: "priced", label: "Fiyatlandırıldı" },
  answered: { key: "answered", label: "Teklif Hazır" },
  approved: { key: "approved", label: "Onaylandı" },
  closed: { key: "closed", label: "Kapandı" },
  cancelled: { key: "cancelled", label: "İptal" },
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeQuantity(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 1) return 1;
  return Math.floor(qty);
}

function normalizePrice(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function normalizeItems(items = []) {
  return items
    .filter((item) => item?.productId || item?.id)
    .map((item) => {
      const resolvedProductId = String(item.productId || item.id);
      const listPrice = normalizePrice(item.listPrice ?? item.price);
      const quantity = normalizeQuantity(item.quantity);
      const specialPrice = normalizePrice(item.specialPrice);

      return {
        productId: resolvedProductId,
        sku: normalizeText(item.sku),
        name: normalizeText(item.name),
        brand: normalizeText(item.brand),
        unit: normalizeText(item.unit, "adet"),
        image: normalizeText(item.image),
        slug: normalizeText(item.slug),
        quantity,
        listPrice,
        price: listPrice,
        requestedPrice: normalizePrice(item.requestedPrice),
        specialPrice: normalizePrice(item.specialPrice),
        lineListTotal: listPrice !== null ? listPrice * quantity : null,
        lineSpecialTotal: specialPrice !== null ? specialPrice * quantity : null,
        groupKey: normalizeText(item.groupKey),
        categoryKey: normalizeText(item.categoryKey),
        subcategoryKey: normalizeText(item.subcategoryKey),
      };
    });
}

function buildQuoteNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `T-${yyyy}${mm}${dd}-${random}`;
}

function buildAccessKey() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getGuestQuoteEntries() {
  if (!isBrowser()) return [];

  try {
    const raw = localStorage.getItem(GUEST_QUOTES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setGuestQuoteEntries(entries) {
  if (!isBrowser()) return;
  localStorage.setItem(GUEST_QUOTES_STORAGE_KEY, JSON.stringify(entries));
}

export function saveGuestQuoteAccess(id, accessKey) {
  if (!isBrowser() || !id || !accessKey) return;

  const current = getGuestQuoteEntries().filter((item) => item?.id !== id);
  current.unshift({ id, accessKey, savedAt: new Date().toISOString() });
  setGuestQuoteEntries(current.slice(0, 50));
}

export function getGuestQuoteAccess(id) {
  return getGuestQuoteEntries().find((item) => item?.id === id) || null;
}

export async function createQuoteRequest({ user, form, items }) {
  const normalizedItems = normalizeItems(items);

  if (!normalizedItems.length) {
    throw new Error("ITEMS_REQUIRED");
  }

  const accessKey = buildAccessKey();
  const listAmount = normalizedItems.reduce(
    (sum, item) => sum + (item.lineListTotal || 0),
    0
  );

  const payload = {
    quoteNo: buildQuoteNo(),
    status: "new",
    userId: user?.uid || null,
    accessKey,
    customer: {
      fullName: normalizeText(form?.fullName || user?.fullName),
      companyName: normalizeText(form?.companyName || user?.businessName),
      phone: normalizeText(form?.phone || user?.phone),
      email: normalizeText(form?.email || user?.email),
      city: normalizeText(form?.city || user?.city),
      position: normalizeText(form?.position || user?.position),
    },
    customerType: user?.uid ? "registered" : "guest",
    note: normalizeText(form?.note),
    requestedTermDays: Number(form?.requestedTermDays) || null,
    requestedDeliveryCity: normalizeText(form?.requestedDeliveryCity || form?.city),
    requestMeta: {
      needsSpecialPricing: true,
      source: "web_quote_form",
      submittedFrom: user?.uid ? "account" : "guest",
    },
    pricing: {
      currency: "KZT",
      listAmount: listAmount || null,
      specialAmount: null,
      specialPreparedAt: null,
      specialPreparedBy: null,
      priceNote: "Liste fiyatı referans olarak kaydedildi. Özel fiyat daha sonra girilebilir.",
    },
    currency: "KZT",
    items: normalizedItems,
    itemCount: normalizedItems.length,
    totalQuantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION_NAME), payload);

  if (!user?.uid) {
    saveGuestQuoteAccess(ref.id, accessKey);
  }

  return { id: ref.id, accessKey };
}

export async function getQuoteRequestById(id) {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export function canViewQuote(item, { userId, accessKey } = {}) {
  if (!item) return false;
  if (userId && item.userId === userId) return true;
  if (accessKey && item.accessKey === accessKey) return true;
  return false;
}

export async function getUserQuoteRequests(userId) {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  const snap = await getDocs(q);
  return snap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
}

export async function getGuestQuoteRequests() {
  const entries = getGuestQuoteEntries();
  if (!entries.length) return [];

  const docs = await Promise.all(
    entries.map(async (entry) => {
      const item = await getQuoteRequestById(entry.id);
      if (!item) return null;
      if (item.accessKey !== entry.accessKey) return null;
      return item;
    })
  );

  return docs
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a?.createdAt?.seconds || 0;
      const bTime = b?.createdAt?.seconds || 0;
      return bTime - aTime;
    });
}

export async function updateQuoteRequestStatus(id, status) {
  if (!QUOTE_STATUSES[status]) {
    throw new Error("INVALID_STATUS");
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}
