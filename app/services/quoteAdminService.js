//app/services/quoteAdminService.js
import { db } from "@/firebase";
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment
} from "firebase/firestore";

// normalize helper
function normalizePhone(phone) {
  return phone?.replace(/\D/g, "") || "";
}

function normalizeEmail(email) {
  return email?.trim().toLowerCase() || "";
}

function buildThreadKey(email, phone) {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);

  if (e && p) return `${e}__${p}`;
  if (e) return e;
  if (p) return p;

  return "unknown";
}

// THREAD BUL / YOKSA OLUŞTUR
export async function getOrCreateThread(customer) {
  const threadKey = buildThreadKey(customer.email, customer.phone);

  const q = query(
    collection(db, "quote_threads"),
    where("threadKey", "==", threadKey)
  );

  const snap = await getDocs(q);

  if (!snap.empty) {
    return { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  const ref = await addDoc(collection(db, "quote_threads"), {
    threadKey,

    customer: {
      name: customer.name || "",
      company: customer.company || "",
      email: normalizeEmail(customer.email),
      phone: normalizePhone(customer.phone)
    },

    stats: {
      totalRequests: 0,
      unreadCount: 0,
      openCount: 0
    },

    lastRequestId: null,
    lastRequestAt: null,
    lastStatus: "received",

    assignedTo: null,

    isArchived: false,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return { id: ref.id };
}

// THREAD UPDATE
export async function updateThreadOnNewRequest(threadId, requestId) {
  const ref = doc(db, "quote_threads", threadId);

  await updateDoc(ref, {
    "stats.totalRequests": increment(1),
    "stats.unreadCount": increment(1),
    "stats.openCount": increment(1),

    lastRequestId: requestId,
    lastRequestAt: serverTimestamp(),
    lastStatus: "received",

    updatedAt: serverTimestamp()
  });
}