// app/categories/page.jsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Loader2,
  SlidersHorizontal,
  X,
  Search,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { categoryData } from "../data/categoryData";
import { useLang } from "../context/LanguageContext";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { app } from "../../firebase";
import ProductCard from "../components/ProductCard";
import {
  getGroupLabel,
  getMainCategoryLabel,
  getSubcategoryLabel,
  resolveProductCategoryKeys,
} from "../lib/catalog/catalogLabels";

const ITEMS_PER_PAGE = 18;
function CategoriesContent() {
  const searchParams = useSearchParams();
  const groupFromUrl = searchParams.get("group");
  const { t, lang } = useLang();

  const [selectedGroup, setSelectedGroup] = useState("institutional");
  const [selectedMainCategories, setSelectedMainCategories] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [expandedCategories, setExpandedCategories] = useState({});

  const db = useMemo(() => getFirestore(app), []);

  useEffect(() => {
    if (groupFromUrl && categoryData[groupFromUrl]) {
      setSelectedGroup(groupFromUrl);
      setSelectedMainCategories([]);
      setCurrentPage(1);
    }
  }, [groupFromUrl]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const q = query(
          collection(db, "products"),
          where("active", "==", true),
          where("webPublished", "==", true)
        );
        const snap = await getDocs(q);
        setAllProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } finally {
        setProductsLoading(false);
      }
    };
    fetchProducts();
  }, [db]);

  const mainCategories = useMemo(
    () => categoryData[selectedGroup]?.mainCategories || {},
    [selectedGroup]
  );
  const mainCategoryKeys = useMemo(() => Object.keys(mainCategories), [mainCategories]);

  const toggleMainCategory = (mainKey) => {
    setCurrentPage(1);
    setSelectedMainCategories((prev) =>
      prev.includes(mainKey) ? prev.filter((x) => x !== mainKey) : [...prev, mainKey]
    );
  };

  const toggleExpandCategory = (key) => {
    setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        const { groupKey, categoryKey, subcategoryKey } = resolveProductCategoryKeys(p);
        const slug = subcategoryKey;
        if (!slug) return false;

        if (groupKey && groupKey !== selectedGroup) return false;

        const belongsToGroup = Object.values(categoryData[selectedGroup].mainCategories).some(
          (list) => list.includes(slug)
        );
        if (!belongsToGroup) return false;

        if (selectedMainCategories.length > 0) {
          const inCategory = selectedMainCategories.some(
            (mainKey) => mainKey === categoryKey && mainCategories[mainKey]?.includes(slug)
          );
          if (!inCategory) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const name = (p.name || p.name_tr || "").toLowerCase();
          if (!name.includes(q)) return false;
        }

        return true;
      })
      .sort((a, b) => a.order - b.order);
  }, [allProducts, selectedGroup, selectedMainCategories, mainCategories, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const groupKeys = Object.keys(categoryData);

  // Group icons mapping
  const groupIcons = {
    institutional: "🏢",
    equipment: "⚙️",
    stainless: "🔩",
  };

  const FilterSidebar = () => (
    <aside className="catalog-sidebar">
      {/* Product Groups */}
      <div className="filter-section">
        <h4 className="filter-section-title">{t("filters.product_groups")}</h4>
        <div className="group-list">
          {groupKeys.map((g) => (
            <button
              key={g}
              onClick={() => {
                setSelectedGroup(g);
                setSelectedMainCategories([]);
                setCurrentPage(1);
                setMobileFilterOpen(false);
              }}
              className={`group-btn ${selectedGroup === g ? "group-btn--active" : ""}`}
            >
              <span className="group-icon">{groupIcons[g] || "📦"}</span>
              <span>{getGroupLabel({ t, lang, groupKey: g, fallback: g })}</span>
              {selectedGroup === g && (
                <span className="active-dot" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="filter-section">
        <div className="filter-section-header">
          <h4 className="filter-section-title">{t("filters.categories")}</h4>
          {selectedMainCategories.length > 0 && (
            <button
              className="clear-btn"
              onClick={() => setSelectedMainCategories([])}
            >
              {t("common.clear") || "Temizle"}
            </button>
          )}
        </div>

        <div className="category-list">
          {mainCategoryKeys.map((mainKey) => {
            const isChecked = selectedMainCategories.includes(mainKey);
            const subItems = mainCategories[mainKey] || [];
            const isExpanded = expandedCategories[mainKey];

            return (
              <div key={mainKey} className="category-item-wrap">
                <div className="category-row">
                  <label className="category-label">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleMainCategory(mainKey)}
                      className="category-checkbox"
                    />
                    <span className="category-name">{getMainCategoryLabel({ t, lang, categoryKey: mainKey, fallback: mainKey })}</span>
                    <span className="category-count">{subItems.length}</span>
                  </label>
                  {subItems.length > 0 && (
                    <button
                      className="expand-btn"
                      onClick={() => toggleExpandCategory(mainKey)}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div className="subcategory-list">
                    {subItems.map((slug) => (
                      <span key={slug} className="subcategory-tag">
                        {getSubcategoryLabel({ t, lang, subcategoryKey: slug, fallback: slug })}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <style>{`
        :root {
          --primary: #0A2540;
          --primary-mid: #0D3461;
          --accent: #00B4D8;
          --accent-light: #CAF0F8;
          --accent-glow: rgba(0,180,216,0.15);
          --gold: #C9A84C;
          --surface: #FFFFFF;
          --surface-2: #F7F9FC;
          --surface-3: #EFF2F7;
          --border: #E3E8EF;
          --text-primary: #0A2540;
          --text-secondary: #5A7184;
          --text-muted: #9BA8B5;
          --success: #0DB67A;
          --radius-sm: 6px;
          --radius-md: 10px;
          --radius-lg: 16px;
          --shadow-sm: 0 1px 3px rgba(10,37,64,0.08);
          --shadow-md: 0 4px 16px rgba(10,37,64,0.10);
          --shadow-lg: 0 8px 32px rgba(10,37,64,0.13);
        }

        .catalog-page {
          min-height: 100vh;
          background: var(--surface-2);
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        /* ── CATALOG HEADER ── */
        .catalog-hero {
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-mid) 60%, #0E4278 100%);
          padding: 36px 0 32px;
          position: relative;
          overflow: hidden;
        }

        .catalog-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }

        .catalog-hero::after {
          content: '';
          position: absolute;
          right: -80px;
          top: -80px;
          width: 340px;
          height: 340px;
          background: radial-gradient(circle, rgba(0,180,216,0.18) 0%, transparent 70%);
          border-radius: 50%;
        }

        .catalog-hero-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
          z-index: 1;
        }

        .catalog-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
        }

        .breadcrumb-link {
          color: rgba(255,255,255,0.65);
          text-decoration: none;
          font-size: 13px;
          transition: color 0.2s;
        }

        .breadcrumb-link:hover { color: white; }

        .breadcrumb-sep { color: rgba(255,255,255,0.35); }

        .breadcrumb-current {
          color: rgba(255,255,255,0.9);
          font-size: 13px;
          font-weight: 500;
        }

        .catalog-hero-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .catalog-title-group h1 {
          font-size: clamp(22px, 4vw, 30px);
          font-weight: 700;
          color: white;
          letter-spacing: -0.5px;
          margin: 0 0 6px;
        }

        .catalog-subtitle {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .product-count-badge {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          backdrop-filter: blur(4px);
        }

        .selected-filters-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .filter-tag {
          background: rgba(0,180,216,0.2);
          border: 1px solid rgba(0,180,216,0.4);
          color: var(--accent-light);
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .filter-tag:hover { background: rgba(0,180,216,0.3); }

        /* ── SEARCH BAR ── */
        .catalog-search-bar {
          background: white;
          border-bottom: 1px solid var(--border);
          padding: 14px 0;
          position: sticky;
          top: 64px;
          z-index: 20;
          box-shadow: var(--shadow-sm);
        }

        .catalog-search-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-field-wrap {
          flex: 1;
          position: relative;
          max-width: 420px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 9px 12px 9px 38px;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          font-size: 14px;
          color: var(--text-primary);
          background: var(--surface-2);
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-glow);
          background: white;
        }

        .view-toggle {
          display: flex;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .view-btn {
          padding: 7px 11px;
          border: none;
          background: white;
          color: var(--text-muted);
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
          display: flex;
          align-items: center;
        }

        .view-btn--active {
          background: var(--primary);
          color: white;
        }

        .mobile-filter-btn {
          display: none;
          align-items: center;
          gap: 8px;
          padding: 9px 16px;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          background: white;
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: border-color 0.2s;
        }

        .mobile-filter-btn:hover { border-color: var(--accent); }

        .filter-count-dot {
          background: var(--accent);
          color: white;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        /* ── LAYOUT ── */
        .catalog-body {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 24px;
          display: flex;
          gap: 24px;
          align-items: flex-start;
        }

        /* ── SIDEBAR ── */
        .catalog-sidebar {
          width: 272px;
          flex-shrink: 0;
          position: sticky;
          top: 120px;
          max-height: calc(100vh - 140px);
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }

        .catalog-sidebar::-webkit-scrollbar { width: 4px; }
        .catalog-sidebar::-webkit-scrollbar-track { background: transparent; }
        .catalog-sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

        .filter-section {
          background: white;
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 18px;
          margin-bottom: 14px;
          box-shadow: var(--shadow-sm);
        }

        .filter-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .filter-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin: 0 0 14px;
        }

        .filter-section-header .filter-section-title { margin: 0; }

        .clear-btn {
          font-size: 12px;
          color: var(--accent);
          background: none;
          border: none;
          cursor: pointer;
          font-weight: 600;
          padding: 0;
        }

        .clear-btn:hover { text-decoration: underline; }

        .group-list { display: flex; flex-direction: column; gap: 4px; }

        .group-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          text-align: left;
          padding: 9px 12px;
          border-radius: var(--radius-md);
          border: 1.5px solid transparent;
          background: none;
          cursor: pointer;
          font-size: 14px;
          color: var(--text-secondary);
          font-weight: 500;
          transition: all 0.2s;
          position: relative;
        }

        .group-btn:hover {
          background: var(--surface-3);
          color: var(--text-primary);
        }

        .group-btn--active {
          background: linear-gradient(135deg, rgba(0,180,216,0.08), rgba(10,37,64,0.06));
          border-color: rgba(0,180,216,0.3);
          color: var(--primary);
          font-weight: 600;
        }

        .group-icon { font-size: 16px; flex-shrink: 0; }

        .active-dot {
          width: 6px;
          height: 6px;
          background: var(--accent);
          border-radius: 50%;
          margin-left: auto;
          flex-shrink: 0;
        }

        .category-list { display: flex; flex-direction: column; gap: 2px; }

        .category-item-wrap { }

        .category-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 0;
        }

        .category-label {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 9px;
          cursor: pointer;
          min-width: 0;
        }

        .category-checkbox {
          width: 15px;
          height: 15px;
          accent-color: var(--accent);
          flex-shrink: 0;
          cursor: pointer;
        }

        .category-name {
          font-size: 13.5px;
          color: var(--text-secondary);
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.15s;
        }

        .category-label:has(.category-checkbox:checked) .category-name {
          color: var(--primary);
          font-weight: 600;
        }

        .category-count {
          font-size: 11px;
          color: var(--text-muted);
          background: var(--surface-3);
          padding: 1px 6px;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .expand-btn {
          padding: 3px;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          flex-shrink: 0;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: background 0.15s;
        }

        .expand-btn:hover { background: var(--surface-3); }

        .subcategory-list {
          padding: 6px 0 8px 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .subcategory-tag {
          font-size: 11.5px;
          color: var(--text-secondary);
          background: var(--surface-3);
          border: 1px solid var(--border);
          padding: 2px 8px;
          border-radius: 20px;
        }

        /* ── PRODUCTS SECTION ── */
        .catalog-products { flex: 1; min-width: 0; }

        .products-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }

        .results-info {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .results-info strong {
          color: var(--text-primary);
          font-weight: 700;
        }

        /* ── PRODUCT GRID ── */
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 18px;
        }

        .product-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── EMPTY STATE ── */
        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: var(--text-secondary);
        }

        .empty-state svg {
          color: var(--text-muted);
          margin: 0 auto 20px;
          display: block;
        }

        .empty-state h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px;
        }

        .empty-state p { font-size: 14px; margin: 0; }

        /* ── LOADING STATE ── */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          gap: 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }

        /* ── PAGINATION ── */
        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid var(--border);
        }

        .page-btn {
          min-width: 38px;
          height: 38px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          border: 1.5px solid var(--border);
          background: white;
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .page-btn:hover:not(.page-btn--active):not(:disabled) {
          border-color: var(--accent);
          color: var(--accent);
        }

        .page-btn--active {
          background: var(--primary);
          border-color: var(--primary);
          color: white;
          font-weight: 700;
        }

        .page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-ellipsis {
          color: var(--text-muted);
          padding: 0 4px;
        }

        /* ── MOBILE DRAWER ── */
        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 100;
          backdrop-filter: blur(2px);
        }

        .mobile-drawer {
          position: fixed;
          left: 0;
          top: 0;
          bottom: 0;
          width: 300px;
          background: white;
          z-index: 101;
          overflow-y: auto;
          padding: 20px;
          box-shadow: var(--shadow-lg);
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border);
        }

        .drawer-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .drawer-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: var(--surface-3);
          border-radius: var(--radius-sm);
          cursor: pointer;
          color: var(--text-secondary);
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 1024px) {
          .catalog-sidebar { display: none; }
          .mobile-filter-btn { display: flex; }
          .mobile-overlay { display: block; }
          .catalog-body { padding: 20px 16px; }
        }

        @media (max-width: 640px) {
          .catalog-hero { padding: 24px 0 20px; }
          .catalog-search-bar { top: 56px; }
          .product-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .catalog-search-inner { gap: 8px; }
          .view-toggle { display: none; }
          .search-field-wrap { max-width: none; }
        }
      `}</style>

      <main className="catalog-page">
        {/* ── HERO HEADER ── */}
        <div className="catalog-hero">
          <div className="catalog-hero-inner">
            <nav className="catalog-breadcrumb">
              <Link href="/" className="breadcrumb-link">{t("categories.breadcrumb.home")}</Link>
              <ChevronRight className="breadcrumb-sep" size={14} />
              <span className="breadcrumb-current">{getGroupLabel({ t, lang, groupKey: selectedGroup, fallback: selectedGroup })}</span>
            </nav>

            <div className="catalog-hero-row">
              <div className="catalog-title-group">
                <h1>{getGroupLabel({ t, lang, groupKey: selectedGroup, fallback: selectedGroup })}</h1>
                <div className="catalog-subtitle">
                  <span className="product-count-badge">
                    {filteredProducts.length} {t("common.product")}
                  </span>
                </div>

                {selectedMainCategories.length > 0 && (
                  <div className="selected-filters-row">
                    {selectedMainCategories.map((key) => (
                      <button
                        key={key}
                        className="filter-tag"
                        onClick={() => toggleMainCategory(key)}
                      >
                        {getMainCategoryLabel({ t, lang, categoryKey: key, fallback: key })}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── SEARCH & TOOLBAR ── */}
        <div className="catalog-search-bar">
          <div className="catalog-search-inner">
            <div className="search-field-wrap">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                className="search-input"
                placeholder={t("common.search") || "Ürün ara..."}
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>

            <button
              className="mobile-filter-btn"
              onClick={() => setMobileFilterOpen(true)}
            >
              <SlidersHorizontal size={16} />
              {t("filters.title") || "Filtrele"}
              {selectedMainCategories.length > 0 && (
                <span className="filter-count-dot">{selectedMainCategories.length}</span>
              )}
            </button>

            <div className="view-toggle" style={{ marginLeft: "auto" }}>
              <button
                className={`view-btn ${viewMode === "grid" ? "view-btn--active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid görünüm"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`view-btn ${viewMode === "list" ? "view-btn--active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Liste görünüm"
              >
                <LayoutList size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="catalog-body">
          <FilterSidebar />

          <section className="catalog-products">
            <div className="products-toolbar">
              <p className="results-info">
                <strong>{filteredProducts.length}</strong> {t("common.product")} bulundu
              </p>
            </div>

            {productsLoading ? (
              <div className="loading-state">
                <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
                <span>Ürünler yükleniyor...</span>
              </div>
            ) : paginatedProducts.length === 0 ? (
              <div className="empty-state">
                <Package size={48} />
                <h3>Ürün bulunamadı</h3>
                <p>Filtre veya arama kriterlerinizi değiştirmeyi deneyin.</p>
              </div>
            ) : (
              <>
                <div className={viewMode === "grid" ? "product-grid" : "product-list"}>
                  {paginatedProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="page-btn"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ‹
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) =>
                        p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1
                      )
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, i) =>
                        p === "..." ? (
                          <span key={`e-${i}`} className="page-ellipsis">…</span>
                        ) : (
                          <button
                            key={p}
                            className={`page-btn ${p === currentPage ? "page-btn--active" : ""}`}
                            onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          >
                            {p}
                          </button>
                        )
                      )}

                    <button
                      className="page-btn"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* ── MOBILE DRAWER ── */}
        {mobileFilterOpen && (
          <>
            <div className="mobile-overlay" onClick={() => setMobileFilterOpen(false)} />
            <div className="mobile-drawer">
              <div className="drawer-header">
                <span className="drawer-title">{t("filters.title") || "Filtreler"}</span>
                <button className="drawer-close" onClick={() => setMobileFilterOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <FilterSidebar />
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F7F9FC",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: "3px solid #E3E8EF",
                borderTopColor: "#00B4D8",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
                margin: "0 auto 16px",
              }}
            />
            <p style={{ color: "#5A7184", fontSize: 14 }}>Yükleniyor...</p>
          </div>
        </div>
      }
    >
      <CategoriesContent />
    </Suspense>
  );
}

