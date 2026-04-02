import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import {
  DEFAULT_IMPORT_PATH,
  DEFAULT_SHEET_NAME,
  ImportValidationError,
  importProductsFromExcel,
  importProductsFromFileBuffer,
} from "@/app/lib/server/productImport";

export const runtime = "nodejs";

const ALLOWED_ROLES = new Set(["super_admin", "admin"]);

function getAdminApp() {
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

async function authorizeImport(request) {
  const authHeader = request.headers.get("authorization") || "";

  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 }),
    };
  }

  const idToken = authHeader.replace("Bearer ", "").trim();
  const adminApp = getAdminApp();
  const adminAuth = getAuth(adminApp);
  const adminDb = getFirestore(adminApp);

  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const requesterRef = adminDb.collection("users").doc(decodedToken.uid);
  const requesterSnap = await requesterRef.get();

  if (!requesterSnap.exists) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Istek sahibi users kaydi bulunamadi." }, { status: 403 }),
    };
  }

  const requesterData = requesterSnap.data();

  if (requesterData?.isActive !== true || !ALLOWED_ROLES.has(requesterData?.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Bu islem icin yetkiniz yok." }, { status: 403 }),
    };
  }

  return {
    ok: true,
    adminDb,
    requester: {
      uid: decodedToken.uid,
      role: requesterData?.role || "",
    },
  };
}

export async function POST(request) {
  try {
    const authResult = await authorizeImport(request);

    if (!authResult.ok) {
      return authResult.response;
    }

    const contentType = request.headers.get("content-type") || "";
    let result = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const uploadedFile = formData.get("excelFile");
      const sheetName = String(formData.get("sheetName") || DEFAULT_SHEET_NAME).trim();
      const dryRun = String(formData.get("dryRun") || "true").trim() === "true";
      const excelPath = String(formData.get("excelPath") || DEFAULT_IMPORT_PATH).trim();

      if (uploadedFile instanceof File && uploadedFile.size > 0) {
        const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
        result = await importProductsFromFileBuffer({
          adminDb: authResult.adminDb,
          fileBuffer,
          fileName: uploadedFile.name,
          sheetName,
          dryRun,
          requestedBy: authResult.requester.uid,
        });
      } else {
        result = await importProductsFromExcel({
          adminDb: authResult.adminDb,
          excelPath,
          sheetName,
          dryRun,
          requestedBy: authResult.requester.uid,
        });
      }
    } else {
      const body = await request.json().catch(() => ({}));

      result = await importProductsFromExcel({
        adminDb: authResult.adminDb,
        excelPath: body?.excelPath || DEFAULT_IMPORT_PATH,
        sheetName: body?.sheetName || DEFAULT_SHEET_NAME,
        dryRun: body?.dryRun === true,
        requestedBy: authResult.requester.uid,
      });
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Products import error:", error);

    if (error instanceof ImportValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details || [],
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || "Import islemi basarisiz oldu.",
      },
      { status: 500 }
    );
  }
}
