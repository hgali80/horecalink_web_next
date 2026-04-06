import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "../../../../lib/server/firebaseAdmin";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const authResult = await authorizeAdminRequest(request);
    if (!authResult.ok) return authResult.response;

    const messageId = params?.messageId;
    if (!messageId) {
      return NextResponse.json(
        { error: "Mesaj id eksik." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const nextRead = body?.read === true;

    await authResult.adminDb.collection("contact_messages").doc(messageId).set(
      {
        read: nextRead,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin contact message update error:", error);
    return NextResponse.json(
      { error: "Mesaj guncellenemedi." },
      { status: 500 }
    );
  }
}
