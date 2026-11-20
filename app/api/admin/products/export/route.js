import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/app/lib/server/firebaseAdmin";
import { exportProductsToExcel } from "@/app/lib/server/productExport";

export const runtime = "nodejs";

const PRODUCT_ADMIN_ROLES = new Set(["admin", "super_admin"]);

export async function GET(request) {
  try {
    const authorization = await authorizeAdminRequest(request, PRODUCT_ADMIN_ROLES);
    if (!authorization.ok) return authorization.response;

    const buffer = await exportProductsToExcel(authorization.adminDb);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="horecalink_urunler_${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Products export error:", error);
    return NextResponse.json(
      { error: error?.message || "Urun Excel disa aktarimi basarisiz oldu." },
      { status: 500 }
    );
  }
}
