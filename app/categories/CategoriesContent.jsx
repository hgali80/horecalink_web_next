// app/categories/CategoriesContent.jsx
"use client";

import { useSearchParams } from "next/navigation";
import CategoriesPage from "./CategoriesPage";

export default function CategoriesContent() {
  const searchParams = useSearchParams();
  return <CategoriesPage searchParams={searchParams} />;
}