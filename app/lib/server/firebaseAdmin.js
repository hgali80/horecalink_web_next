import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export const STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "staff",
  "sales",
  "viewer",
]);

export function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env degiskenleri eksik.");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminServices() {
  const adminApp = getAdminApp();

  return {
    adminApp,
    adminAuth: getAuth(adminApp),
    adminDb: getFirestore(adminApp),
  };
}

export async function authorizeAdminRequest(request, allowedRoles = STAFF_ROLES) {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 }),
    };
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  const { adminAuth, adminDb } = getAdminServices();
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const requesterRef = adminDb.collection("users").doc(decodedToken.uid);
  const requesterSnap = await requesterRef.get();

  if (!requesterSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Istek sahibi users kaydi bulunamadi." },
        { status: 403 }
      ),
    };
  }

  const requesterData = requesterSnap.data();

  if (requesterData?.isActive !== true || !allowedRoles.has(requesterData?.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Bu islem icin yetkiniz yok." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    adminDb,
    requester: {
      uid: decodedToken.uid,
      role: requesterData?.role || "",
      fullName: requesterData?.fullName || "",
      email: requesterData?.email || decodedToken.email || "",
    },
  };
}
