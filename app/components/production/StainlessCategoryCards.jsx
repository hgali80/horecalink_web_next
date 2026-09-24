'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '../../context/LanguageContext';
import { buildCatalogTree } from '../../lib/catalog/categoryTree';
import { CATEGORY_COLORS, categoryImageKey, readCategoryImagesResponse } from '../../lib/categoryImages';
import MainCategoryImage from '../MainCategoryImage';

export default function StainlessCategoryCards({ title }) {
  const { t, lang } = useLang();
  const [images, setImages] = useState({});
  const group = buildCatalogTree({ t, lang }).find(item => item.key === 'stainless-steel');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/category-images', { cache: 'no-store', signal: controller.signal })
      .then(readCategoryImagesResponse).then(data => setImages(data.images || {}))
      .catch(error => { if (error.name !== 'AbortError') console.error('Category images unavailable', error); });
    return () => controller.abort();
  }, []);

  return <section id="families" className="scroll-mt-40 py-10">
    <h2 className="mb-7 text-3xl font-bold tracking-tight">{title}</h2>
    <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">
      {group?.categories.map(category => <Link key={category.key}
        href={`/catalog/${group.key}/${category.key}`}
        className="overflow-hidden rounded-2xl border-[3px] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
        style={{ borderColor: CATEGORY_COLORS[group.key] }}>
        <MainCategoryImage src={images[categoryImageKey(group.key, category.key)]?.src} group={group.key}>
          <h3>{category.label}</h3>
        </MainCategoryImage>
      </Link>)}
    </div>
  </section>;
}
