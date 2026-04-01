//app/api/admin/users/create/route.js
import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

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

const ALLOWED_NEW_ROLES = ["admin", "staff", "sales", "viewer"];

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Yetkisiz istek." },
        { status: 401 }
      );
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
        { error: "Bu işlem için sadece super yönetici yetkilidir." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const fullName = String(body?.fullName || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "").trim();
    const role = String(body?.role || "").trim();
    const isActive = body?.isActive === true;

    if (!fullName) {
      return NextResponse.json(
        { error: "Ad soyad zorunludur." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "E-posta zorunludur." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalıdır." },
        { status: 400 }
      );
    }

    if (!ALLOWED_NEW_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Geçersiz rol seçildi." },
        { status: 400 }
      );
    }

    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json(
        { error: "Bu e-posta ile kayıtlı bir kullanıcı zaten var." },
        { status: 409 }
      );
    } catch (err) {
      if (err?.code !== "auth/user-not-found") {
        throw err;
      }
    }

    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
      disabled: !isActive,
    });

    await adminDb.collection("users").doc(createdUser.uid).set({
      fullName,
      email,
      phone: "",
      role,
      isActive,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: decodedToken.uid,
      lastLoginAt: null,
    });

    return NextResponse.json({
      ok: true,
      uid: createdUser.uid,
      email,
      role,
    });
  } catch (err) {
    console.error("Create admin user error:", err);

    let errorText = "Kullanıcı oluşturulamadı.";

    if (err?.code === "auth/email-already-exists") {
      errorText = "Bu e-posta zaten kayıtlı.";
    } else if (err?.code === "auth/invalid-password") {
      errorText = "Geçersiz şifre. Daha güçlü bir şifre girin.";
    } else if (err?.code === "auth/invalid-email") {
      errorText = "Geçerli bir e-posta girin.";
    }

    return NextResponse.json({ error: errorText }, { status: 500 });
  }
}