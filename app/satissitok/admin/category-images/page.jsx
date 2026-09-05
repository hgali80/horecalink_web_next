'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/firebase';
import { useLang } from '@/app/context/LanguageContext';
import { buildCatalogTree } from '@/app/lib/catalog/categoryTree';
import { CATEGORY_GROUPS, CATEGORY_COLORS, categoryImageKey, readCategoryImagesResponse } from '@/app/lib/categoryImages';
import { validateBannerFile } from '@/app/lib/homeBanner';
import MainCategoryImage from '@/app/components/MainCategoryImage';

async function prepareImage(file) {
  validateBannerFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 36000000) throw new Error('Görsel en fazla 36 megapiksel olmalıdır.');
    const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Tarayıcı görseli hazırlayamadı.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('Görsel hazırlanamadı.');
    return new File([blob], 'category.webp', { type: blob.type });
  } finally { URL.revokeObjectURL(url); }
}

export default function CategoryImagesAdmin() {
  const { t, lang } = useLang();
  const [images, setImages] = useState({});
  const [drafts, setDrafts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const urls = useRef(new Set());
  const tree = buildCatalogTree({ t, lang });
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/category-images', { cache: 'no-store', signal: controller.signal }).then(readCategoryImagesResponse)
      .then(data => { setImages(data.images || {}); setLoaded(true); })
      .catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    const allocated = urls.current;
    return () => { controller.abort(); allocated.forEach(url => URL.revokeObjectURL(url)); };
  }, []);
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function clearDraft(key) {
    if (drafts[key]?.src) { URL.revokeObjectURL(drafts[key].src); urls.current.delete(drafts[key].src); }
    setDrafts(current => { const next = { ...current }; delete next[key]; return next; });
  }
  async function selectFile(event, key) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(''); setMessage(''); setBusy(key);
    try {
      const prepared = await prepareImage(file);
      clearDraft(key);
      const src = URL.createObjectURL(prepared);
      urls.current.add(src);
      setDrafts(current => ({ ...current, [key]: { file: prepared, src } }));
    } catch (error) { setError(error.message || 'Görsel okunamadı.'); }
    finally { setBusy(''); }
  }
  async function save(key, label, remove = false) {
    setBusy(key); setError(''); setMessage('');
    try {
      if (!auth.currentUser) throw new Error('Oturumunuzu yenileyin.');
      const form = new FormData();
      form.append('key', key);
      if (remove) form.append('remove', 'true'); else form.append('file', drafts[key].file);
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/category-images', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await readCategoryImagesResponse(response);
      setImages(data.images); clearDraft(key);
      setMessage(`${label}: ${remove ? 'Görsel kaldırıldı.' : 'Görsel kaydedildi ve yayınlandı.'}`);
    } catch (error) { setError(error.message); }
    finally { setBusy(''); }
  }
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <Link href="/satissitok/admin" className="text-sm text-blue-700 underline">Yönetim paneline dön</Link>
    <h1 className="text-2xl font-bold">Ana Kategori Görselleri</h1>
    <p className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-slate-700">Her kategori için tek tek görsel seçip önizleyin, ardından kartın Kaydet düğmesine basın. JPG, PNG veya WebP, en fazla 10 MB / 36 megapiksel. Önerilen ölçü 800 × 800 pikseldir. Görsel tüm kartı doldurur; farklı oranlardaki görsellerin kenarları kırpılabilir. Kategori adı görselin alt kısmında gösterilir. Görsel atanmayan kategorilerde grup ikonu gösterilir.</p>
    <Link href="/catalog" target="_blank" rel="noopener noreferrer" className="inline-block text-blue-700 underline">Kategori sayfasını görüntüle</Link>
    <div className="sticky top-2 z-10" aria-live="polite">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
      {busy && <p className="rounded-lg bg-blue-50 p-3">Görsel işleniyor…</p>}
    </div>
    {!loaded ? <p>{error ? 'Görseller yüklenemedi. Sayfayı yenileyip tekrar deneyin.' : 'Yükleniyor…'}</p> : CATEGORY_GROUPS.map(key => {
      const group = tree.find(item => item.key === key);
      if (!group) return null;
      return <section key={key}><h2 className="mb-4 text-xl font-bold">{group.label}</h2>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{group.categories.map(category => {
          const id = categoryImageKey(key, category.key);
          return <article key={id} className="overflow-hidden rounded-2xl border-[3px] bg-white" style={{ borderColor: CATEGORY_COLORS[key] }}>
            <MainCategoryImage src={drafts[id]?.src || images[id]?.src} group={key}>
              <h3 className="flex min-h-12 items-center justify-center font-bold text-[#1d3246]">{category.label}</h3>
            </MainCategoryImage>
            <div className="space-y-3 p-4">
              <fieldset disabled={Boolean(busy)} className="space-y-3 disabled:opacity-50">
                <label className="block text-sm font-medium" htmlFor={id}>Görsel yükle / değiştir</label>
                <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-xs" onChange={event => selectFile(event, id)} />
                <div className="flex flex-wrap gap-2 text-sm">
                  <button type="button" disabled={!drafts[id]} onClick={() => save(id, category.label)} className="rounded-lg bg-slate-800 px-3 py-2 text-white disabled:opacity-40">Kaydet</button>
                  {drafts[id] && <button type="button" onClick={() => clearDraft(id)} className="rounded-lg border px-3 py-2">Vazgeç</button>}
                  {images[id] && <button type="button" onClick={() => save(id, category.label, true)} className="rounded-lg border px-3 py-2 text-red-700">Kaldır</button>}
                </div>
                {drafts[id] && <p className="text-xs text-amber-700">Önizleme — henüz kaydedilmedi.</p>}
              </fieldset>
            </div>
          </article>;
        })}</div>
      </section>;
    })}
  </main>;
}
