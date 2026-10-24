'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/firebase';
import CelebrationWelcome from '@/app/components/CelebrationWelcome';
import { CELEBRATIONS } from '@/app/lib/celebrations';
import { CelebrationStrip, CelebrationDetail } from '@/app/components/Celebration';

async function requestSettings(method = 'GET', body) {
  if (!auth.currentUser) throw new Error('Oturumunuzu yenileyin.');
  const token = await auth.currentUser.getIdToken();
  const response = await fetch('/api/admin/celebrations', {
    method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
  return data;
}

export default function CelebrationsAdmin() {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null);
  const [language, setLanguage] = useState('kz');
  const [welcomePreview, setWelcomePreview] = useState(null);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setSettings(await requestSettings()); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(id) {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await requestSettings('PUT', { activeId: settings.activeId === id ? null : id, revision: settings.revision });
      setSettings(next);
      setMessage(next.activeId ? 'Kutlama aktif edildi. Siteye gelen ziyaretçilere gösterilecek.' : 'Kutlama pasif edildi. Yeni sayfa açılışlarında gösterilmeyecek.');
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <Link href="/satissitok/admin" className="text-sm text-blue-700 underline">Yönetim paneline dön</Link>
    <div><h1 className="text-2xl font-bold text-slate-900">Bayram ve Özel Günler</h1><p className="mt-2 text-sm leading-6 text-slate-600">Kutlamaları istediğiniz zaman açıp kapatın; her yıl yeniden kullanın. Üst şerit tüm ziyaretçi sayfalarında, dekoratif kart ise ana sayfada görünür. Ana sayfada ayrıca her ziyaret sırasında bir kez tam ekran, yarı saydam ve hareketli kutlama açılır.</p></div>
    <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">Kontrol sizde: Kutlama kendiliğinden kapanmaz. Bayram sonunda buradan pasif edin. Aynı anda yalnızca bir kutlama aktif olabilir. Açık sayfalar yenilendiğinde veya ziyaretçi sekmeye döndüğünde güncellenir.</p>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}<button type="button" disabled={busy} onClick={load} className="ml-3 underline disabled:opacity-50">Yeniden yükle</button></div>}
    {message && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{message}</p>}
    {!settings ? <p>{busy ? 'Yükleniyor…' : 'Ayarlar yüklenemedi.'}</p> : CELEBRATIONS.map(item => <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <div><h2 className="font-semibold text-slate-900">{item.name} <span className="font-normal text-slate-500">— {item.date}</span></h2><p className={`mt-2 text-sm font-medium ${settings.activeId === item.id ? 'text-green-700' : 'text-slate-500'}`}>{settings.activeId === item.id ? 'Aktif' : 'Pasif'}</p></div>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setWelcomePreview(item)} className="rounded-lg border border-[#007e94] px-4 py-2 text-sm font-semibold text-[#007e94]">Tam ekran önizle</button><button type="button" onClick={() => setPreview(preview?.id === item.id ? null : item)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" aria-expanded={preview?.id === item.id}>Önizle</button><button type="button" disabled={busy} onClick={() => toggle(item.id)} aria-pressed={settings.activeId === item.id} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${settings.activeId === item.id ? 'bg-slate-700' : 'bg-[#007e94]'}`}>{busy ? 'İşleniyor…' : settings.activeId === item.id ? 'Pasif et' : 'Aktif et'}</button></div>
    </article>)}
    {preview && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-3 p-4"><h2 className="font-semibold">Önizleme</h2><label className="text-sm">Dil <select value={language} onChange={event => setLanguage(event.target.value)} className="ml-2 rounded-lg border p-2"><option value="kz">Қазақша</option><option value="ru">Русский</option><option value="tr">Türkçe</option><option value="en">English</option></select></label></div><CelebrationStrip celebration={preview} language={language} /><div className="bg-[#edf1f3] p-4 sm:p-8"><div className="max-w-md"><CelebrationDetail celebration={preview} language={language} /></div></div><p className="p-4 text-xs text-slate-500">Önizleme siteyi etkilemez. Ziyaretçiler mesajı seçtikleri dilde görür.</p></section>}
    {welcomePreview && <CelebrationWelcome celebration={welcomePreview} language={language} preview onDismiss={() => setWelcomePreview(null)} />}
  </main>;
}
