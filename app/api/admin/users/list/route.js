//app/api/admin/users/list/route.js
import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const runtime = "nodejs";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env değişkenleri eksik.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
    }

    const idToken = authHeader.replace("Bearer ", "").trim();

    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const requesterRef = adminDb.collection("users").doc(decodedToken.uid);
    const requesterSnap = await requesterRef.get();

    if (!requesterSnap.exists) {
      return NextResponse.json(
        { error: "İstek sahibi users kaydı bulunamadı." },
        { status: 403 }
      );
    }

    const requesterData = requesterSnap.data();

    if (
      requesterData?.isActive !== true ||
      requesterData?.role !== "super_admin"
    ) {
      return NextResponse.json(
        { error: "Bu alanı sadece super yönetici görüntüleyebilir." },
        { status: 403 }
      );
    }

    const snap = await adminDb.collection("users").get();

    const users = snap.docs.map((doc) => {
      const data = doc.data();

      return {
        uid: doc.id,
        fullName: data.fullName || "",
        email: data.email || "",
        phone: data.phone || "",
        role: data.role || "",
        isActive: data.isActive === true,
        createdBy: data.createdBy || "",
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString?.() || null,
      };
    });

    users.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    return NextResponse.json({ ok: true, users });
  } catch (err) {
    console.error("List admin users error:", err);
    return NextResponse.json(
      { error: "Kullanıcı listesi alınamadı." },
      { status: 500 }
    );
  }
}