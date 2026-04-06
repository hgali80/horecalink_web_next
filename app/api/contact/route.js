import { NextResponse } from "next/server";
import { getAdminServices } from "../../lib/server/firebaseAdmin";

export const runtime = "nodejs";

function normalizeText(value, maxLength = 1000) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, maxLength);
}

export async function POST(request) {
  try {
    const body = await request.json();

    const name = normalizeText(body?.name, 120);
    const phone = normalizeText(body?.phone, 40);
    const message = normalizeText(body?.message, 2000);
    const email = normalizeText(body?.email, 160);
    const lang = normalizeText(body?.lang, 10) || "tr";

    if (!name || !phone || !message) {
      return NextResponse.json(
        { error: "Ad, telefon ve mesaj zorunludur." },
        { status: 400 }
      );
    }

    const { adminDb } = getAdminServices();

    const ref = await adminDb.collection("contact_messages").add({
      name,
      phone,
      email: email || "",
      message,
      lang,
      read: false,
      source: "contact_form",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    console.error("Contact message create error:", error);
    return NextResponse.json(
      { error: "Mesaj kaydedilemedi." },
      { status: 500 }
    );
  }
}
