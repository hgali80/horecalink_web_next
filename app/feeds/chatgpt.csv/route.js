import { getAdminServices } from "../../lib/server/firebaseAdmin";
import {
  buildChatgptCommerceProduct,
  serializeChatgptCommerceCsv,
} from "../../lib/server/chatgptCommerceFeed.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const { adminDb } = getAdminServices();
    const productsRef = adminDb.collection("products");
    const [productsSnapshot, stockSnapshot] = await Promise.all([
      productsRef
        .where("active", "==", true)
        .where("webPublished", "==", true)
        .select(
          "sku", "name", "name_ru", "description_ru", "shortDescription_ru", "description", "shortDescription",
          "specs_ru", "technicalDetails_ru", "technical_specs_ru", "specs", "material_ru", "dimensions_ru",
          "capacity_ru", "power_ru", "voltage_ru", "fuelType_ru", "weight_ru", "warranty_ru", "brand",
          "price", "slug", "image_names", "imageBase", "active", "webPublished", "saleEnabled",
          "stockTracked", "productType"
        )
        .get(),
      adminDb.collection("erp_stock_balances").select("rQty", "fQty").get(),
    ]);

    const stockByProductId = new Map(stockSnapshot.docs.map((doc) => [doc.id, doc.data()]));
    const rows = productsSnapshot.docs
      .map((doc) => buildChatgptCommerceProduct({ id: doc.id, ...doc.data() }, stockByProductId.get(doc.id)))
      .filter(Boolean);

    return new Response(serializeChatgptCommerceCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'inline; filename="chatgpt.csv"',
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("ChatGPT commerce product feed failed:", error);
    return new Response("Product feed temporarily unavailable.\n", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}
