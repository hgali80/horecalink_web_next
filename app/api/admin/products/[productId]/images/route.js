import { NextResponse } from "next/server";

import {
  authorizeAdminRequest,
  getAdminServices,
} from "@/app/lib/server/firebaseAdmin";

export const runtime = "nodejs";

const PRODUCT_EDITOR_ROLES = new Set(["admin", "super_admin"]);
const IMAGE_FOLDER = "product_images/";

function cleanText(value) {
  return (value ?? "").toString().trim();
}

function toStem(value) {
  return cleanText(value).replace(/\.[a-z0-9]+$/i, "");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function belongsToProduct(filename, stems) {
  if (!filename || filename.includes("/") || filename.includes("\\")) return false;

  return stems.some((stem) => {
    const pattern = new RegExp(
      `^${escapeRegex(stem)}(?:-(\\d+))?\\.[a-z0-9]+$`,
      "i"
    );
    return pattern.test(filename);
  });
}

export async function DELETE(request, context) {
  try {
    const authorization = await authorizeAdminRequest(
      request,
      PRODUCT_EDITOR_ROLES
    );
    if (!authorization.ok) return authorization.response;

    const { productId } = await context.params;
    const id = cleanText(productId);
    const body = await request.json();
    const imageNames = Array.from(
      new Set(
        (Array.isArray(body?.imageNames) ? body.imageNames : [])
          .map(cleanText)
          .filter(Boolean)
      )
    );

    if (!id || imageNames.length === 0) {
      return NextResponse.json(
        { error: "Silinecek ürün fotoğrafı belirtilmedi." },
        { status: 400 }
      );
    }

    const productRef = authorization.adminDb.collection("products").doc(id);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }

    const product = productSnap.data() || {};
    const stems = Array.from(
      new Set(
        [
          id,
          product.stock_code,
          product.sku,
          product.manufacturerCode,
          product.imageBase,
        ]
          .map(toStem)
          .filter(Boolean)
      )
    );
    const invalidName = imageNames.find(
      (filename) => !belongsToProduct(filename, stems)
    );

    if (invalidName) {
      return NextResponse.json(
        { error: `Fotoğraf bu ürüne ait değil: ${invalidName}` },
        { status: 400 }
      );
    }

    const currentImageNames = Array.isArray(product.image_names)
      ? product.image_names.map(cleanText).filter(Boolean)
      : [];
    const stillReferenced = imageNames.find((name) =>
      currentImageNames.includes(name)
    );

    if (stillReferenced) {
      return NextResponse.json(
        { error: "Fotoğraf ürün kaydından henüz kaldırılmamış." },
        { status: 409 }
      );
    }

    for (const imageName of imageNames) {
      const otherProduct = await authorization.adminDb
        .collection("products")
        .where("image_names", "array-contains", imageName)
        .limit(1)
        .get();

      if (!otherProduct.empty) {
        return NextResponse.json(
          { error: `Fotoğraf başka bir ürün tarafından kullanılıyor: ${imageName}` },
          { status: 409 }
        );
      }
    }

    const { adminStorage } = getAdminServices();
    const bucket = adminStorage.bucket();

    await Promise.all(
      imageNames.map((imageName) =>
        bucket.file(`${IMAGE_FOLDER}${imageName}`).delete({ ignoreNotFound: true })
      )
    );

    return NextResponse.json({ ok: true, deleted: imageNames });
  } catch (error) {
    console.error("Product image delete error:", error);
    return NextResponse.json(
      { error: "Ürün fotoğrafı Storage alanından silinemedi." },
      { status: 500 }
    );
  }
}
