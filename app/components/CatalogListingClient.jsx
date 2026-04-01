//app/components/CatalogListingClient.jsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import ProductCard from "./ProductCard";
import { buildCatalogTree } from "../lib/catalog/categoryTree";
import { getCatalogLabels } from "../lib/catalog/categoryLabels";
import { getCatalogProducts } from "../lib/firestore/products";
import { useLang } from "../context/LanguageContext";

const PAGE_SIZE = 12;

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim();
}

function getSearchBlob(product) {
  return normalizeText(
    [
      product?.name,
      product?.name_tr,
      product?.description,
      product?.shortDescription,
      product?.manufacturerCode,
      product?.sku,
      product?.brand,
      Array.isArray(product?.tags) ? product.tags.join(" ") : "",
      product?.searchText,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function getBrandLabel(product) {
  return String(product?.brand || "Diger").trim() || "Diger";
}

function sortFilteredProducts(products, sortValue) {
  const list = [...products];

  if (sortValue === "price_asc") {
    return list.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
  }

  if (sortValue === "price_desc") {
    return list.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
  }

  if (sortValue === "name_asc") {
    return list.sort((a, b) =>
      String(a?.name || a?.name_tr || "").localeCompare(
        String(b?.name || b?.name_tr || ""),
        "ru"
      )
    );
  }

  return list.sort((a, b) => {
    const aOrder = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : 999999;
    const bOrder = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : 999999;

    if (aOrder !== bOrder) return aOrder - bOrder;

    return String(a?.name || a?.name_tr || "").localeCompare(
      String(b?.name || b?.name_tr || ""),
      "ru"
    );
  });
}

function getCategoryHref(groupKey, categoryKey) {
  return `/catalog/${groupKey}/${categoryKey}`;
}

function getGroupHref(groupKey) {
  return `/catalog/${groupKey}`;
}

export default function CatalogListingClient({
  group,
  category = null,
  subcategory = null,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useLang();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const tree = useMemo(() => buildCatalogTree(t), [t]);
  const labels = useMemo(
    () => getCatalogLabels({ group, category, subcategory, t }),
    [category, group, subcategory, t]
  );

  const searchValue = searchParams.get("q") || "";
  const sortValue = searchParams.get("sort") || "sort_order";
  const brandValue = searchParams.get("brand") || "";
  const pageValue = Number(searchParams.get("page") || 1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const items = await getCatalogProducts({
          groupKey: group,
          categoryKey: category || null,
          subcategoryKey: subcategory || null,
        });

        if (!cancelled) {
          setProducts(items);
        }
      } catch (error) {
        console.error("Catalog load error:", error);
        if (!cancelled) {
          setProducts([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [category, group, subcategory]);

  const availableBrands = useMemo(
    () => [...new Set(products.map(getBrandLabel))].sort((a, b) => a.localeCompare(b, "ru")),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeText(searchValue);

    const next = products.filter((product) => {
      if (brandValue && getBrandLabel(product) !== brandValue) return false;
      if (normalizedQuery && !getSearchBlob(product).includes(normalizedQuery)) return false;
      return true;
    });

    return sortFilteredProducts(next, sortValue);
  }, [brandValue, products, searchValue, sortValue]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, pageValue), totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProducts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredProducts]);

  function updateParams(nextParams) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(nextParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });

    if (!Object.prototype.hasOwnProperty.call(nextParams, "page")) {
      params.set("page", "1");
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }

  const pageTitle = subcategory
    ? labels.subcategoryLabel
    : category
      ? labels.categoryLabel
      : labels.groupLabel;

  const pageDescription = subcategory
    ? t("catalog.subcategoryDescription")
    : category
      ? t("catalog.categoryDescription")
      : t("catalog.groupDescription");

  const sidebar = (
    <div className="space-y-6">
      <div className="rounded-[28px] bg-[#f2f4f6] p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[32px] font-extrabold tracking-[-0.04em] text-[#12263a]">
              {t("breadcrumb.categories")}
            </h2>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {t("catalog.hierarchy")}
            </p>
          </div>

          <button
            onClick={() => router.replace(pathname)}
            className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#1d3246]"
          >
            {t("filters.reset") || "Reset"}
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {tree.map((groupItem) => {
            const isCurrentGroup = groupItem.key === group;
            const groupHref = getGroupHref(groupItem.key);

            return (
              <details key={groupItem.key} open={isCurrentGroup} className="rounded-[22px] bg-white px-4 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <Link
                    href={groupHref}
                    className={`flex items-center gap-3 text-[15px] font-extrabold ${
                      isCurrentGroup ? "text-[#12263a]" : "text-slate-600"
                    }`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full ${
                        isCurrentGroup ? "bg-[#1d3246]" : "bg-slate-300"
                      }`}
                    />
                    {groupItem.label}
                  </Link>

                  <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                </summary>

                <div className="mt-4 space-y-3">
                  {groupItem.categories.map((categoryItem) => {
                    const categorySelected = groupItem.key === group && categoryItem.key === category;
                    const categoryHref = getCategoryHref(groupItem.key, categoryItem.key);

                    return (
                      <details
                        key={`${groupItem.key}-${categoryItem.key}`}
                        open={categorySelected}
                        className="rounded-[18px] bg-[#f8f9fb] px-3 py-3"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                          <Link
                            href={categoryHref}
                            className={`text-[14px] font-bold ${
                              categorySelected ? "text-[#12263a]" : "text-slate-600"
                            }`}
                          >
                            {categoryItem.label}
                          </Link>

                          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                        </summary>

                        <div className="mt-3 space-y-1">
                          {categoryItem.subcategories.map((subItem) => {
                            const active =
                              groupItem.key === group &&
                              categoryItem.key === category &&
                              subItem.key === subcategory;

                            return (
                              <Link
                                key={`${groupItem.key}-${categoryItem.key}-${subItem.key}`}
                                href={`/catalog/${groupItem.key}/${categoryItem.key}/${subItem.key}`}
                                className={`flex items-start gap-2 rounded-xl px-2 py-2 text-[13px] leading-5 transition ${
                                  active
                                    ? "bg-white font-semibold text-[#12263a]"
                                    : "text-slate-500 hover:bg-white hover:text-[#1d3246]"
                                }`}
                              >
                                <span
                                  className={`mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full ${
                                    active ? "bg-[#1d3246]" : "bg-slate-300"
                                  }`}
                                />
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="rounded-[28px] bg-[#f2f4f6] p-6">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
          {t("filters.brand") || "Brand"}
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={() => updateParams({ brand: "", page: 1 })}
            className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
              !brandValue ? "bg-white text-[#12263a] shadow-sm" : "bg-white/60 text-slate-600 hover:bg-white"
            }`}
          >
            <span>{t("filters.all") || "All"}</span>
            {!brandValue ? <CheckCircle2 className="h-4 w-4 text-[#1d3246]" /> : null}
          </button>

          {availableBrands.map((brand) => (
            <button
              key={brand}
              onClick={() => updateParams({ brand, page: 1 })}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                brandValue === brand
                  ? "bg-white text-[#12263a] shadow-sm"
                  : "bg-white/60 text-slate-600 hover:bg-white"
              }`}
            >
              <span>{brand}</span>
              {brandValue === brand ? <CheckCircle2 className="h-4 w-4 text-[#1d3246]" /> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <section className="bg-[#f7f8fa] pb-20 pt-10">
      <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 xl:px-8">
        <div className="mb-6 flex items-center gap-2 text-[13px] text-slate-500">
          <Link href="/" className="hover:text-[#1d3246]">
            {t("breadcrumb.home")}
          </Link>

          <ChevronRight className="h-4 w-4" />
          {category ? (
            <Link href={`/catalog/${group}`} className="hover:text-[#1d3246]">
              {labels.groupLabel}
            </Link>
          ) : (
            <span className="text-[#12263a]">{labels.groupLabel}</span>
          )}

          {category ? (
            <>
              <ChevronRight className="h-4 w-4" />
              {subcategory ? (
                <Link href={`/catalog/${group}/${category}`} className="hover:text-[#1d3246]">
                  {labels.categoryLabel}
                </Link>
              ) : (
                <span className="text-[#12263a]">{labels.categoryLabel}</span>
              )}
            </>
          ) : null}

          {subcategory ? (
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="text-[#12263a]">{labels.subcategoryLabel}</span>
            </>
          ) : null}
        </div>

        <div className="mb-8 rounded-[32px] bg-white p-6 shadow-[0_20px_60px_rgba(29,50,70,0.06)] md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                HorecaLink Catalog
              </div>
              <h1 className="mt-3 text-[40px] font-extrabold tracking-[-0.05em] text-[#12263a] md:text-[52px]">
                {pageTitle}
              </h1>
              <p className="mt-3 max-w-[760px] text-[15px] leading-7 text-slate-500">{pageDescription}</p>
            </div>

            <button
              onClick={() => setMobileFilterOpen((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#1d3246] lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {t("filters.title") || "Filters"}
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => updateParams({ q: event.target.value, page: 1 })}
                placeholder={t("filters.searchPlaceholder") || "Search by product, brand or code"}
                className="h-14 w-full rounded-2xl border-0 bg-[#f4f6f8] pl-11 pr-4 text-[14px] text-slate-700 outline-none transition focus:ring-2 focus:ring-[#1d3246]/20"
              />
            </div>

            <select
              value={sortValue}
              onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}
              className="h-14 rounded-2xl border-0 bg-[#f4f6f8] px-4 text-[14px] text-slate-700 outline-none transition focus:ring-2 focus:ring-[#1d3246]/20"
            >
              <option value="sort_order">{t("filters.sort.default") || "Default sort"}</option>
              <option value="name_asc">{t("filters.sort.nameAsc") || "Name A-Z"}</option>
              <option value="price_asc">{t("filters.sort.priceAsc") || "Price ascending"}</option>
              <option value="price_desc">{t("filters.sort.priceDesc") || "Price descending"}</option>
            </select>

            <div className="flex h-14 items-center justify-center rounded-2xl bg-[#f4f6f8] px-4 text-[14px] font-bold text-[#12263a]">
              {filteredProducts.length} {t("catalog.results_found")}
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="hidden lg:block">{sidebar}</aside>

          <div>
            {mobileFilterOpen ? <div className="mb-6 lg:hidden">{sidebar}</div> : null}

            {loading ? (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[470px] animate-pulse rounded-[28px] bg-white shadow-[0_20px_50px_rgba(29,50,70,0.06)]"
                  />
                ))}
              </div>
            ) : paginatedProducts.length ? (
              <>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-12 flex items-center justify-center gap-3">
                    <button
                      disabled={currentPage <= 1}
                      onClick={() => updateParams({ page: currentPage - 1 })}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="rounded-full bg-white px-5 py-3 text-[13px] font-bold text-[#12263a] shadow-sm">
                      {currentPage} / {totalPages}
                    </div>

                    <button
                      disabled={currentPage >= totalPages}
                      onClick={() => updateParams({ page: currentPage + 1 })}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-[28px] bg-white px-8 py-16 text-center shadow-[0_18px_60px_rgba(29,50,70,0.06)]">
                <h3 className="text-[24px] font-extrabold tracking-[-0.03em] text-[#12263a]">
                  {t("catalog.empty_title")}
                </h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-500">{t("catalog.empty_desc")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
