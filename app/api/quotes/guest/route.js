import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminServices } from "../../../lib/server/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUOTES_PER_REQUEST = 50;
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function secureEquals(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function serializeDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function publicCustomer(customer = {}) {
  return {
    fullName: customer.fullName || "",
    companyName: customer.companyName || "",
    phone: customer.phone || "",
    email: customer.email || "",
    city: customer.city || "",
    position: customer.position || "",
  };
}

function publicItem(item = {}) {
  return {
    productId: item.productId || "",
    sku: item.sku || "",
    name: item.name || "",
    brand: item.brand || "",
    unit: item.unit || "",
    image: item.image || "",
    slug: item.slug || "",
    quantity: item.quantity || 0,
    listPrice: item.listPrice ?? null,
    price: item.price ?? null,
    requestedPrice: item.requestedPrice ?? null,
    specialPrice: item.specialPrice ?? null,
    discountPercent: item.discountPercent ?? null,
    lineListTotal: item.lineListTotal ?? null,
    lineSpecialTotal: item.lineSpecialTotal ?? null,
    lineTotal: item.lineTotal ?? null,
    pricing: item.pricing || null,
  };
}

function publicPricing(pricing = {}) {
  return {
    currency: pricing.currency || "KZT",
    listAmount: pricing.listAmount ?? null,
    specialAmount: pricing.specialAmount ?? null,
    finalAmount: pricing.finalAmount ?? null,
    discountAmount: pricing.discountAmount ?? null,
    priceNote: pricing.priceNote || "",
    specialPreparedAt: serializeDate(pricing.specialPreparedAt),
  };
}

function publicQuote(id, data) {
  return {
    id,
    quoteNo: data.quoteNo || "",
    status: data.status || "new",
    customer: publicCustomer(data.customer),
    customerType: "guest",
    note: data.note || "",
    requestedTermDays: data.requestedTermDays ?? null,
    requestedDeliveryCity: data.requestedDeliveryCity || "",
    pricing: publicPricing(data.pricing),
    currency: data.currency || data.pricing?.currency || "KZT",
    items: Array.isArray(data.items) ? data.items.map(publicItem) : [],
    itemCount: data.itemCount || 0,
    totalQuantity: data.totalQuantity || 0,
    createdAt: serializeDate(data.createdAt),
    updatedAt: serializeDate(data.updatedAt),
    notes: { customerNote: data.notes?.customerNote || "" },
  };
}

function noStoreJson(body, init = {}) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > 50_000) {
      return noStoreJson({ error: "Istek cok buyuk." }, { status: 413 });
    }

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return noStoreJson({ error: "Gecersiz istek." }, { status: 400 });
    }

    const rawEntries = Array.isArray(body?.entries) ? body.entries : null;

    if (!rawEntries) {
      return noStoreJson({ error: "Gecersiz istek." }, { status: 400 });
    }

    const entries = rawEntries
      .slice(0, MAX_QUOTES_PER_REQUEST)
      .map((entry) => ({
        id: typeof entry?.id === "string" ? entry.id.trim() : "",
        accessKey:
          typeof entry?.accessKey === "string" ? entry.accessKey.trim() : "",
      }))
      .filter(
        (entry) =>
          DOCUMENT_ID_PATTERN.test(entry.id) &&
          entry.accessKey.length >= 16 &&
          entry.accessKey.length <= 256
      )
      .filter(
        (entry, index, allEntries) =>
          allEntries.findIndex(
            (candidate) =>
              candidate.id === entry.id &&
              candidate.accessKey === entry.accessKey
          ) === index
      );

    if (!entries.length) return noStoreJson({ items: [] });

    const { adminDb } = getAdminServices();
    const refs = entries.map((entry) =>
      adminDb.collection("quote_requests").doc(entry.id)
    );
    const snapshots = await adminDb.getAll(...refs);

    const items = snapshots.flatMap((snapshot, index) => {
      if (!snapshot.exists) return [];

      const data = snapshot.data();
      const entry = entries[index];

      if (data?.userId || !secureEquals(data?.accessKey, entry.accessKey)) {
        return [];
      }

      return [publicQuote(snapshot.id, data)];
    });

    return noStoreJson({ items });
  } catch (error) {
    console.error("Guest quotes read error:", error);
    return noStoreJson(
      { error: "Teklifler yuklenemedi." },
      { status: 500 }
    );
  }
}
