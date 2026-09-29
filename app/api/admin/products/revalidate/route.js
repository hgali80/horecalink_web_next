import { NextResponse } from "next/server";

import { authorizeAdminRequest } from "@/app/lib/server/firebaseAdmin";
import { revalidatePublicProductPages } from "@/app/lib/server/productPageCache";

export const runtime = "nodejs";

const PRODUCT_EDITOR_ROLES = new Set(["admin", "super_admin"]);

export async function POST(request) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      PRODUCT_EDITOR_ROLES
    );
    if (!authorization.ok) return authorization.response;

    revalidatePublicProductPages();

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Product page cache revalidation error:", error);
    return NextResponse.json(
      { error: "Ürün sayfası önbelleği yenilenemedi." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
