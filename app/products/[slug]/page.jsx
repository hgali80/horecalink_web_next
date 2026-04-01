import { notFound } from "next/navigation";

import ProductDetailClient from "./ProductDetailClient";
import {
  getProductBySlug,
  getRelatedProducts,
} from "../../lib/firestore/products";

export default async function ProductDetailPage({ params }) {
  const { slug } = await params;

  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product, 8);

  return <ProductDetailClient product={product} relatedProducts={relatedProducts} />;
}
