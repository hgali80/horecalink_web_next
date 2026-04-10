import { notFound } from "next/navigation";

import ProductDetailClient from "./ProductDetailClient";
import {
  getProductBySlug,
  getRelatedProducts,
} from "../../lib/firestore/products";
import { hydrateProductImageNames } from "../../lib/server/productImages";

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const hydratedProduct = await hydrateProductImageNames(product);
  const relatedProducts = await getRelatedProducts(hydratedProduct, 8);

  return <ProductDetailClient product={hydratedProduct} relatedProducts={relatedProducts} />;
}
