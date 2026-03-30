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

export const QUOTE_STATUSES = {
  draft: { key: "draft", label: "Taslak" },
  new: { key: "new", label: "Yeni Talep" },
  reviewing: { key: "reviewing", label: "İnceleniyor" },
  priced: { key: "priced", label: "Fiyatlandırıldı" },
  answered: { key: "answered", label: "Cevaplandı" },
  closed: { key: "closed", label: "Kapandı" },
  cancelled: { key: "cancelled", label: "İptal" },
};

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeQuantity(value) {
  const qty = Number(value);
  if (!Number.isFinite(qty) || qty < 1) return 1;
  return Math.floor(qty);
}

function normalizeItems(items = []) {
  return items
    .filter((item) => item?.productId)
    .map((item) => ({
      productId: String(item.productId),
      sku: normalizeText(item.sku),
      name: normalizeText(item.name),
      brand: normalizeText(item.brand),
      unit: normalizeText(item.unit, "adet"),
      image: normalizeText(item.image),
      quantity: normalizeQuantity(item.quantity),
      price: Number(item.price) || null,
      groupKey: normalizeText(item.groupKey),
      categoryKey: normalizeText(item.categoryKey),
      subcategoryKey: normalizeText(item.subcategoryKey),
    }));
}

function buildQuoteNo() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `T-${yyyy}${mm}${dd}-${random}`;
}

export async function createQuoteRequest({ user, form, items }) {
  if (!user?.uid) {
    throw new Error("AUTH_REQUIRED");
  }

  const normalizedItems = normalizeItems(items);

  if (!normalizedItems.length) {
    throw new Error("ITEMS_REQUIRED");
  }

  const payload = {
    quoteNo: buildQuoteNo(),
    status: "new",
    userId: user.uid,
    customer: {
      fullName: normalizeText(form?.fullName || user.fullName),
      companyName: normalizeText(form?.companyName || user.businessName),
      phone: normalizeText(form?.phone || user.phone),
      email: normalizeText(form?.email || user.email),
      city: normalizeText(form?.city || user.city),
      position: normalizeText(form?.position || user.position),
    },
    note: normalizeText(form?.note),
    requestedTermDays: Number(form?.requestedTermDays) || null,
    requestedDeliveryCity: normalizeText(form?.requestedDeliveryCity || form?.city),
    currency: "KZT",
    items: normalizedItems,
    itemCount: normalizedItems.length,
    totalQuantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, COLLECTION_NAME), payload);
  return ref.id;
}

export async function getQuoteRequestById(id) {
  const snap = await getDoc(doc(db, COLLECTION_NAME, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
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

export async function updateQuoteRequestStatus(id, status) {
  if (!QUOTE_STATUSES[status]) {
    throw new Error("INVALID_STATUS");
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}
