// app/categories/[sub]/page.jsx
"use client";

import { useParams } from "next/navigation";
import ProductList from "../../components/ProductList";

export default function SubCategoryPage() {
  const { sub } = useParams(); // [sub] olduğu için sub

  return (
    <main className="min-h-screen bg-white">
      {/* 
        ❌ BURADA BAŞLIK YOK 
        Başlık ProductList.jsx içinde, breadcrumb’ın altında
      */}
      <ProductList filterSubCategory={sub} />
    </main>
  );
}
