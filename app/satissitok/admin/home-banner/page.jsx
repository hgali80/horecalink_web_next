/* eslint-disable @next/next/no-img-element */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/firebase';
import { BANNER_DEFAULTS, BANNER_MAX_MB, validateBannerFile, validateBannerDimensions, validateBannerSettings } from '@/app/lib/homeBanner';
import { BannerCarousel } from '@/app/components/HomeBanner';
import { prepareBannerUpload, readBannerResponse } from '@/app/lib/homeBannerUpload';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2';
const buttonClass = 'rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100 disabled:opacity-40';

export default function HomeBannerAdmin() {
  const [settings, setSettings] = useState(BANNER_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(null);
  const dragId = useRef(null);
  const urls = useRef(new Set());

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/home-banner', { signal: controller.signal, cache: 'no-store' })
      .then(readBannerResponse)
      .then(data => { setSettings(data); setLoaded(true); setLoading(false); })
      .catch(error => { if (error.name !== 'AbortError') { setError(error.message); setLoading(false); } });
    const allocated = urls.current;
    return () => { controller.abort(); allocated.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(next) {
    setSettings(next); setDirty(true); setMessage(''); setPreview(null);
  }

  async function addFiles(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    setError(''); setMessage('');
    if (settings.slides.length + files.length > 5) { setError('En fazla 5 görsel ekleyebilirsiniz.'); return; }
    setBusy(true);
    const added = [];
    try {
      for (const file of files) {
        try { validateBannerFile(file); }
        catch (error) { throw new Error(`${file.name}: ${error.message}`); }
        const src = URL.createObjectURL(file);
        urls.current.add(src);
        try {
          const image = new window.Image();
          image.src = src;
          await image.decode();
          validateBannerDimensions(image.naturalWidth, image.naturalHeight);
          added.push({ id: crypto.randomUUID(), src, file, alt: file.name.replace(/\.[^.]+$/, ''), href: '' });
        } catch (error) { URL.revokeObjectURL(src); urls.current.delete(src); throw error; }
      }
      update({ ...settings, slides: [...settings.slides, ...added] });
    } catch (error) {
      added.forEach(slide => { URL.revokeObjectURL(slide.src); urls.current.delete(slide.src); });
      setError(error.message || 'Görsel okunamadı.');
    } finally { setBusy(false); }
  }

  function editSlide(id, key, value) {
    update({ ...settings, slides: settings.slides.map(slide => slide.id === id ? { ...slide, [key]: value } : slide) });
  }

  function move(id, destination) {
    const slides = [...settings.slides];
    const origin = slides.findIndex(slide => slide.id === id);
    if (origin < 0 || destination < 0 || destination >= slides.length || origin === destination) return;
    const [slide] = slides.splice(origin, 1);
    slides.splice(destination, 0, slide);
    update({ ...settings, slides });
  }

  async function save(event) {
    event.preventDefault(); setError(''); setMessage('');
    try {
      validateBannerSettings(settings);
      setBusy(true);
      if (!auth.currentUser) throw new Error('Oturumunuzu yenileyin.');
      const form = new FormData();
      form.append('settings', JSON.stringify({ ...settings, slides: settings.slides.map(({ id, alt, href }) => ({ id, alt, href })) }));
      for (const slide of settings.slides) {
        if (slide.file) {
          setMessage(`Görsel hazırlanıyor: ${slide.alt}`);
          form.append(slide.id, await prepareBannerUpload(slide.file));
        }
      }
      setMessage('Görseller kaydediliyor…');
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/home-banner', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await readBannerResponse(response);
      setSettings(data); setPreview(null); setDirty(false);
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear();
      setMessage('Kaydedildi. Görsel şerit ana sayfada yayınlandı.');
    } catch (error) { setMessage(''); setError(error.message); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link href="/satissitok/admin" className="text-sm text-blue-700 underline">Yönetim paneline dön</Link>
      <h1 className="text-2xl font-bold text-slate-900">Ana Sayfa Görsel Şeridi</h1>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-slate-700">
        <p className="font-semibold">Görsel yükleme kuralları</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Önerilen yatay oran: <strong>3:1</strong>. <strong>2,7:1–3,3:1</strong> aralığındaki görseller de kabul edilir. Önerilen çözünürlük: <strong>1500 × 500 piksel</strong>.</li>
          <li>Dosya başına en fazla <strong>{BANNER_MAX_MB} MB</strong> ve <strong>36 megapiksel</strong>. Formatlar: <strong>JPG, PNG, WebP</strong> (hareketsiz).</li>
          <li>Yayınlamak için en az <strong>2</strong>, en fazla <strong>5</strong> görsel gerekir.</li>
          <li>Mobilde de 3:1 oranı korunur; görsele eklenen yazıları kısa ve büyük tutun.</li>
          <li>Görsel kırpılmadan alana sığdırılır; oran farkına göre kenarlarda küçük boşluklar olabilir. Yüklemeden önce otomatik küçültülüp WebP formatında sıkıştırılır; orijinal dosyanız değişmez.</li>
          <li>Her seferinde tek görsel gösterilir. Otomatik geçiş sağdan sola ilerler.</li>
        </ul>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
      {loading ? <p>Yükleniyor…</p> : <form onSubmit={save}>
        <fieldset disabled={busy || !loaded} className="space-y-6 disabled:opacity-60">
          <div className="flex flex-wrap items-center gap-6 rounded-xl border bg-white p-5">
            <label className="flex items-center gap-2"><input type="checkbox" checked={settings.autoplay} onChange={event => update({ ...settings, autoplay: event.target.checked })} />Otomatik geçiş</label>
            <label className="flex items-center gap-2">Bekleme süresi (saniye)<input aria-label="Bekleme süresi (saniye)" className={`${inputClass} max-w-20`} type="number" min="2" max="60" step="1" value={settings.interval} onChange={event => update({ ...settings, interval: Number(event.target.value) })} required /></label>
            <p className="text-sm text-slate-500">2–60 saniye • Kayma süresi: 0,6 saniye</p>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <label className="block font-semibold" htmlFor="banner-files">Görsel ekle ({settings.slides.length}/5)</label>
            <input id="banner-files" className="mt-3 block w-full text-sm" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={settings.slides.length >= 5 || busy} onChange={addFiles} />
            <p className="mt-3 text-sm text-slate-500">Sıralamak için kartları sürükleyin veya yukarı/aşağı düğmelerini kullanın. Değişiklikler Kaydet ile yayınlanır.</p>
          </div>
          {settings.slides.map((slide, index) => <article key={slide.id} draggable={!busy} onDragStart={event => { dragId.current = slide.id; event.dataTransfer.setData('text/plain', slide.id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragId.current = null; }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) move(dragId.current, index); dragId.current = null; }} className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-[240px_1fr]">
            <div><p className="mb-2 font-semibold">{index + 1}. görsel</p><img src={slide.src} alt={slide.alt} draggable={false} className="aspect-[3/1] w-full rounded-lg bg-slate-100 object-contain" /></div>
            <div className="space-y-3">
              <label className="block text-sm">Görsel açıklaması<input className={inputClass} value={slide.alt} maxLength={200} required onChange={event => editSlide(slide.id, 'alt', event.target.value)} /></label>
              <label className="block text-sm">Bağlantı (isteğe bağlı)<input className={inputClass} value={slide.href} maxLength={2000} placeholder="/products veya https://…" onChange={event => editSlide(slide.id, 'href', event.target.value)} /></label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} type="button" disabled={index === 0} onClick={() => move(slide.id, index - 1)} aria-label={`${index + 1}. görseli yukarı taşı`}>↑ Yukarı</button>
                <button className={buttonClass} type="button" disabled={index === settings.slides.length - 1} onClick={() => move(slide.id, index + 1)} aria-label={`${index + 1}. görseli aşağı taşı`}>↓ Aşağı</button>
                <button className={`${buttonClass} text-red-700`} type="button" onClick={() => update({ ...settings, slides: settings.slides.filter(item => item.id !== slide.id) })}>Kaldır</button>
              </div>
            </div>
          </article>)}
          {settings.slides.length < 2 && <p className="text-sm text-amber-700">Yayınlamak için {2 - settings.slides.length} görsel daha ekleyin.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button className="rounded-lg bg-[#003366] px-6 py-3 font-semibold text-white disabled:opacity-40" type="submit" disabled={settings.slides.length < 2}>{busy ? 'İşleniyor…' : 'Kaydet ve yayınla'}</button>
            <button className={buttonClass} type="button" disabled={settings.slides.length < 2} onClick={() => setPreview({ ...settings })}>Önizle</button>
            {dirty && <span className="text-sm text-amber-700">Kaydedilmemiş değişiklikler var.</span>}
          </div>
        </fieldset>
      </form>}
      {preview && <div className="rounded-xl border py-4"><h2 className="mb-4 px-6 font-semibold">Önizleme</h2><BannerCarousel key={JSON.stringify(preview)} settings={preview} /></div>}
    </main>
  );
}
