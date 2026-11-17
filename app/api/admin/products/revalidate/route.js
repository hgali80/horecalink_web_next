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

    const cacheRevalidated = revalidatePublicProductPages();
    if (!cacheRevalidated) {
      return NextResponse.json(
        {
          ok: false,
          cacheRevalidated: false,
          error: "Ürün değişikliği kaydedildi; ürün sayfası önbelleği yenilenemedi.",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, cacheRevalidated: true },
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
