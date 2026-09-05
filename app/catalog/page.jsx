'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useLang } from '../context/LanguageContext';
import { buildCatalogTree } from '../lib/catalog/categoryTree';
import { CATEGORY_GROUPS, CATEGORY_COLORS, categoryImageKey, readCategoryImagesResponse } from '../lib/categoryImages';
import MainCategoryImage from '../components/MainCategoryImage';
const copy = {
  tr: { intro: 'Tüm ana kategorileri keşfedin; ürünleri görmek için bir kategori seçin.', all: 'Bütün ürünler' },
  en: { intro: 'Explore all main categories. Select a category to view its products.', all: 'All products' },
  ru: { intro: 'Все основные категории на одной странице. Выберите категорию, чтобы посмотреть товары.', all: 'Все товары' },
  kz: { intro: 'Барлық негізгі санаттар бір бетте. Тауарларды көру үшін санатты таңдаңыз.', all: 'Барлық тауарлар' },
};
export default function CatalogLandingPage() {
  const { t, lang } = useLang();
  const [images, setImages] = useState({});
  const tree = buildCatalogTree({ t, lang });
  const labels = copy[lang] || copy.tr;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/category-images', { cache: 'no-store', signal: controller.signal })
      .then(readCategoryImagesResponse).then(data => setImages(data.images || {}))
      .catch(error => { if (error.name !== 'AbortError') console.error('Category images unavailable', error); });
    return () => controller.abort();
  }, []);
  return <main className="min-h-screen bg-[#f8f9fb] px-4 pb-16 pt-10 md:px-6 lg:px-8">
    <div className="mx-auto max-w-[1440px]">
      <nav aria-label={t('breadcrumb.categories')} className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:underline">{t('breadcrumb.home')}</Link><ChevronRight className="h-4 w-4" /><span>{t('breadcrumb.categories')}</span>
      </nav>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-5">
        <div><h1 className="text-4xl font-extrabold tracking-tight text-[#1d3246]">{t('breadcrumb.categories')}</h1><p className="mt-3 text-slate-600">{labels.intro}</p></div>
        <Link href="/products" className="rounded-xl bg-[#1d3246] px-5 py-3 font-semibold text-white hover:bg-slate-700">{labels.all}</Link>
      </header>
      <div className="space-y-12">
        {CATEGORY_GROUPS.map(key => {
          const group = tree.find(item => item.key === key);
          if (!group) return null;
          return <section key={key} aria-labelledby={`group-${key}`}>
            <h2 id={`group-${key}`} className="mb-5 border-l-4 pl-3 text-2xl font-bold text-[#1d3246]" style={{ borderColor: CATEGORY_COLORS[key] }}>{group.label}</h2>
            <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
              {group.categories.map(category => <Link key={category.key} href={`/catalog/${key}/${category.key}`} className="overflow-hidden rounded-2xl border-[3px] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900" style={{ borderColor: CATEGORY_COLORS[key] }}>
                <MainCategoryImage src={images[categoryImageKey(key, category.key)]?.src} group={key} />
                <div className="px-3 py-4 text-center"><span className="text-xs font-medium text-slate-500">{group.label}</span><h3 className="mt-2 flex min-h-[3rem] items-center justify-center text-base font-bold leading-6 text-[#1d3246] md:text-lg">{category.label}</h3></div>
              </Link>)}
            </div>
          </section>;
        })}
      </div>
    </div>
  </main>;
}
