import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "../../../lib/server/firebaseAdmin";

export const runtime = "nodejs";

function serializeDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name || "",
    phone: data.phone || "",
    email: data.email || "",
    message: data.message || "",
    lang: data.lang || "tr",
    read: data.read === true,
    source: data.source || "",
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  };
}

export async function GET(request) {
  try {
    const authResult = await authorizeAdminRequest(request);
    if (!authResult.ok) return authResult.response;

    const snap = await authResult.adminDb
      .collection("contact_messages")
      .orderBy("createdAt", "desc")
      .get();

    return NextResponse.json({
      ok: true,
      messages: snap.docs.map(serializeDoc),
    });
  } catch (error) {
    console.error("Admin contact messages list error:", error);
    return NextResponse.json(
      { error: "Mesajlar alinamadi." },
      { status: 500 }
    );
  }
}
