//app/api/admin/users/[uid]/status/route.js
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

async function assertSuperAdmin(adminDb, adminAuth, request) {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return { error: "Yetkisiz istek.", status: 401 };
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  const decodedToken = await adminAuth.verifyIdToken(idToken);

  const requesterRef = adminDb.collection("users").doc(decodedToken.uid);
  const requesterSnap = await requesterRef.get();

  if (!requesterSnap.exists) {
    return { error: "İstek sahibi users kaydı bulunamadı.", status: 403 };
  }

  const requesterData = requesterSnap.data();

  if (
    requesterData?.isActive !== true ||
    requesterData?.role !== "super_admin"
  ) {
    return {
      error: "Bu işlem için sadece super yönetici yetkilidir.",
      status: 403,
    };
  }

  return { ok: true, requesterUid: decodedToken.uid };
}

async function getSuperAdminCount(adminDb) {
  const snap = await adminDb
    .collection("users")
    .where("role", "==", "super_admin")
    .where("isActive", "==", true)
    .get();

  return snap.size;
}

export async function PATCH(request, context) {
  try {
    const adminApp = getAdminApp();
    const adminAuth = getAuth(adminApp);
    const adminDb = getFirestore(adminApp);

    const authResult = await assertSuperAdmin(adminDb, adminAuth, request);
    if (!authResult.ok) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { uid } = await context.params;
    const body = await request.json();
    const nextIsActive = body?.isActive === true;

    if (!uid) {
      return NextResponse.json(
        { error: "Kullanıcı UID eksik." },
        { status: 400 }
      );
    }

    if (uid === authResult.requesterUid) {
      return NextResponse.json(
        { error: "Kendi hesabını buradan pasif/aktif yapamazsın." },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Kullanıcı kaydı bulunamadı." },
        { status: 404 }
      );
    }

    const userData = userSnap.data();

    if (userData?.role === "super_admin" && nextIsActive === false) {
      const superAdminCount = await getSuperAdminCount(adminDb);

      if (superAdminCount <= 1) {
        return NextResponse.json(
          {
            error:
              "Son aktif super yönetici pasif yapılamaz.",
          },
          { status: 400 }
        );
      }
    }

    await adminAuth.updateUser(uid, {
      disabled: !nextIsActive,
    });

    await userRef.set(
      {
        isActive: nextIsActive,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: authResult.requesterUid,
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      uid,
      isActive: nextIsActive,
    });
  } catch (err) {
    console.error("Update user status error:", err);
    return NextResponse.json(
      { error: "Kullanıcı durumu güncellenemedi." },
      { status: 500 }
    );
  }
}