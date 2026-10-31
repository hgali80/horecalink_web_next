'use client';
/* eslint-disable @next/next/no-img-element -- Draft previews use authenticated blob URLs. */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { auth } from '@/firebase/index';
import { CHANNELS, CHANNEL_LABELS, DEFAULT_SETTINGS, almatyToUtc } from '@/app/lib/socialPublishing.mjs';

const labels = { pending_approval: 'Onay bekliyor', scheduled: 'Takvimde', queued: 'Sırada', publishing: 'Yayınlanıyor', published: 'Yayınlandı', cancelled: 'İptal edildi', needs_review: 'İnceleme gerekli' };
const dateText = value => new Date(value).toLocaleString('tr-TR', { timeZone: 'Asia/Almaty', dateStyle: 'short', timeStyle: 'short' });
async function api(path = '', options = {}) {
  const current = auth.currentUser;
  if (!current) throw new Error('Oturum açın.');
  const token = await current.getIdToken();
  const response = await fetch(`/api/admin/social${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'İşlem tamamlanamadı.');
  return body;
}
const postApi = body => api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export default function SocialPage() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Yükleniyor…</p>;
  if (!user || !['admin', 'super_admin'].includes(user.role)) return <p className="p-8">Bu alan için yönetici oturumu gerekli. <Link href="/login" className="underline">Giriş yapın</Link></p>;
  return <PublishingCenter key={user.uid} />;
}
function PublishingCenter() {
  const [data, setData] = useState({ posts: [], logs: [], jobs: [], settings: DEFAULT_SETTINGS, connection: {} });
  const [products, setProducts] = useState([]), [cursor, setCursor] = useState(null);
  const [productId, setProductId] = useState(''), [search, setSearch] = useState('');
  const [channels, setChannels] = useState(['instagram', 'facebook']), [media, setMedia] = useState({}), [captions, setCaptions] = useState({}), [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const [view, setView] = useState('calendar'), [preview, setPreview] = useState(null);
  const refresh = useCallback(async () => setData(await api()), []);
  const loadProducts = useCallback(async (after = '') => {
    const result = await api(`?products=1${after ? `&cursor=${encodeURIComponent(after)}` : ''}`);
    setProducts(old => after ? [...new Map([...old, ...result.products].map(p => [p.id, p])).values()] : result.products);
    setCursor(result.nextCursor);
  }, []);
  useEffect(() => { let live = true; Promise.all([api(), api('?products=1')]).then(([state, catalog]) => { if (live) { setData(state); setProducts(catalog.products); setCursor(catalog.nextCursor); } }).catch(err => { if (live) setError(err.message); }); return () => { live = false; }; }, []);
  async function act(fn, success) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); await refresh(); setMessage(success); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function upload(channel, file) {
    if (!file) return;
    if (!productId) { setError('Önce ürün seçin.'); return; }
    await act(async () => {
      const form = new FormData(); form.set('file', file); form.set('channel', channel); form.set('productId', productId);
      const result = await api('/assets', { method: 'POST', body: form });
      setMedia(old => ({ ...old, [channel]: { source: 'custom', assetId: result.id } }));
    }, `${CHANNEL_LABELS[channel]} görseli hazır.`);
  }
  const product = products.find(p => p.id === productId);
  const missingCustomMedia = channels.some(channel => media[channel]?.source === 'custom' && !media[channel]?.assetId);
  const filtered = products.filter(p => `${p.name} ${p.sku}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
  async function showPreview(post) {
    setBusy(true); setError('');
    const images = {};
    try {
      for (const channel of post.channels) {
        const selection = post.media[channel];
        if (selection.source === 'custom') {
          const token = await auth.currentUser.getIdToken();
          const response = await fetch(`/api/admin/social/assets?id=${encodeURIComponent(selection.assetId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
          if (!response.ok) throw new Error('Önizleme görseli yüklenemedi.');
          images[channel] = URL.createObjectURL(await response.blob());
        } else images[channel] = `https://firebasestorage.googleapis.com/v0/b/horecakatalog-e2d10.firebasestorage.app/o/${encodeURIComponent(`product_images/${selection.imageNames[0]}`)}?alt=media`;
      }
      setPreview({ ...post, images });
    } catch (err) { Object.values(images).filter(url => url.startsWith('blob:')).forEach(URL.revokeObjectURL); setError(err.message); }
    finally { setBusy(false); }
  }
  function closePreview() { Object.values(preview?.images || {}).filter(url => url.startsWith('blob:')).forEach(URL.revokeObjectURL); setPreview(null); }
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-slate-500">HorecaLink · Merkezi yayın</p><h1 className="text-3xl font-semibold text-slate-900">Yayın merkezi</h1><p className="mt-2 text-sm text-slate-600">Ürünlerinizi kanallara göre hazırlayın, onaylayın ve takvime alın.</p></div><Link href="/satissitok/admin" className="rounded-lg border p-3 text-sm">Yönetim paneli</Link></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}
    <section aria-label="Yayın ayarları" className="flex flex-wrap items-center gap-5 rounded-xl border bg-slate-50 p-5">
      <label className="text-sm">Çalışma şekli <select disabled={busy} value={data.settings.mode} onChange={e => act(() => postApi({ action: 'settings', ...data.settings, mode: e.target.value }), 'Çalışma şekli kaydedildi.')} className="ml-2 rounded border bg-white p-2"><option value="approval">Önce onay</option><option value="automatic">Otomatik takvim</option></select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.settings.paused} disabled={busy} onChange={e => act(() => postApi({ action: 'settings', ...data.settings, paused: e.target.checked }), 'Duraklatma tercihi kaydedildi.')} />Yayınları duraklat</label>
      <span className="text-sm text-slate-500">Saat dilimi: Almatı (UTC+5)</span>
      {!data.connection.workerEnabled && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900">Yayın motoru henüz etkinleştirilmedi</span>}
      <p className="w-full text-xs text-slate-500">Otomatik takvim, yeni hazırladığınız yayınları ayrıca onay beklemeden sıraya alır. WhatsApp seçimi ürün kataloğunu günceller; müşterilere mesaj göndermez.</p>
    </section>
    <section className="rounded-xl border p-5"><h2 className="mb-4 text-lg font-semibold">Yeni yayın</h2>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm">Ürün ara<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Yüklenen ürünlerde ad veya SKU" className="mt-1 w-full rounded-lg border p-3" /></label><label className="text-sm">Ürün<select disabled={busy} value={productId} onChange={e => { setProductId(e.target.value); setMedia({}); setCaptions({}); }} className="mt-1 w-full rounded-lg border p-3"><option value="">Ürün seçin</option>{filtered.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}</select></label></div>
      {cursor && <button disabled={busy} onClick={() => act(() => loadProducts(cursor), 'Daha fazla ürün yüklendi.')} className="mt-3 text-sm underline">Daha fazla ürün yükle</button>}
      {product && <p className="mt-3 text-xs text-slate-500">Mevcut durum: Web {product.webPublished ? 'açık' : 'kapalı'} · WhatsApp katalog {product.whatsappPublished ? 'açık' : 'kapalı'}{!product.active && ' · Ürün pasif; yayınlanamaz.'}</p>}
      <div className="my-5 flex flex-wrap gap-5">{CHANNELS.map(channel => <label key={channel} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={channels.includes(channel)} disabled={busy} onChange={e => setChannels(old => e.target.checked ? [...old, channel] : old.filter(c => c !== channel))} />{CHANNEL_LABELS[channel]}</label>)}</div>
      <div className="grid gap-4 md:grid-cols-2">{channels.map(channel => <fieldset key={channel} className="space-y-3 rounded-xl border p-4"><legend className="px-2 font-medium">{CHANNEL_LABELS[channel]}</legend>
        <label className="block text-sm">Görsel kaynağı<select value={media[channel]?.source || 'web'} disabled={busy} onChange={e => setMedia(old => ({ ...old, [channel]: { ...old[channel], source: e.target.value } }))} className="mt-1 w-full rounded border p-2"><option value="web">Web ürün görseli</option><option value="custom">Bilgisayardan özel görsel</option></select></label>
        {media[channel]?.source === 'custom' && <label className="block text-sm">Bu kanala özel görsel<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !productId} onChange={e => { upload(channel, e.target.files?.[0]); e.target.value = ''; }} className="mt-1 block w-full text-xs" /><span className="mt-2 block text-xs text-slate-500">{media[channel]?.assetId ? 'Görsel yüklendi. Önizlemeyi onay ekranında kontrol edin.' : 'Görsel yükleyin: JPEG, PNG veya WebP · en fazla 10 MB'}</span></label>}
        {['instagram', 'facebook'].includes(channel) && <label className="block text-sm">Yayın metni<textarea value={captions[channel] || ''} maxLength={channel === 'instagram' ? 2200 : 5000} onChange={e => setCaptions(old => ({ ...old, [channel]: e.target.value }))} className="mt-1 min-h-28 w-full rounded border p-2" /></label>}
        {channel === 'web' && <p className="text-xs text-slate-500">Zamanı geldiğinde ürünün web yayını açılır. Özel görsel seçilirse web görselleri bu yayınla güncellenir.</p>}
        {channel === 'whatsapp' && <p className="text-xs text-slate-500">Zamanı geldiğinde mevcut ürün kataloğu entegrasyonu çalışır. Fiyat ve teknik bilgiler ürün kaydından alınır.</p>}
      </fieldset>)}</div>
      <div className="mt-5 flex flex-wrap items-end gap-4"><label className="text-sm">Yayın zamanı (Almatı)<input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="mt-1 block rounded border p-2" /></label><button disabled={busy || !productId || !channels.length || !scheduledAt || !product?.active || missingCustomMedia} onClick={() => act(async () => { await postApi({ action: 'create', productId, channels, media, captions, scheduledAt: almatyToUtc(scheduledAt) }); setMedia({}); setCaptions({}); }, data.settings.mode === 'automatic' ? 'Yayın takvime alındı.' : 'Yayın onay kuyruğuna eklendi.')} className="rounded-lg bg-slate-900 px-5 py-3 text-sm text-white disabled:opacity-40">{busy ? 'İşleniyor…' : data.settings.mode === 'automatic' ? 'Takvime al' : 'Onaya gönder'}</button></div>
    </section>
    <section className="rounded-xl border p-5"><div className="mb-4 flex flex-wrap justify-between gap-3"><div className="flex gap-3"><button aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} className="rounded border px-3 py-2 text-sm">Takvim ve onaylar</button><button aria-pressed={view === 'logs'} onClick={() => setView('logs')} className="rounded border px-3 py-2 text-sm">Yayın kayıtları</button></div><button disabled={busy} onClick={() => act(refresh, 'Liste yenilendi.')} className="text-sm underline">Yenile</button></div>
      {view === 'calendar' ? <div className="space-y-3">{!data.posts.length && <p className="py-8 text-center text-slate-500">Henüz planlanmış yayın yok.</p>}{[...data.posts].sort((a, b) => a.scheduledAt - b.scheduledAt).map(post => <article key={post.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><div><p className="font-medium">{post.product.sku} · {post.product.name}</p><p className="mt-1 text-sm text-slate-500">{dateText(post.scheduledAt)} · {labels[post.status] || post.status}</p><div className="mt-2 flex flex-wrap gap-2">{post.channels.map(channel => { const job = data.jobs.find(j => j.postId === post.id && j.channel === channel); return <span key={channel} className="rounded bg-slate-100 px-2 py-1 text-xs">{CHANNEL_LABELS[channel]} · {labels[job?.status || post.status] || job?.status}</span>; })}</div></div><div className="flex gap-3"><button disabled={busy} onClick={() => showPreview(post)} className="text-sm underline">Önizle</button>{['pending_approval', 'scheduled'].includes(post.status) && <button disabled={busy} onClick={() => act(() => postApi({ action: 'cancel', id: post.id, revision: post.revision }), 'Yayın iptal edildi.')} className="text-sm text-red-700 underline">İptal et</button>}</div></article>)}</div> : <div className="overflow-auto"><p className="mb-3 text-xs text-slate-500">Son 100 olay gösterilir. Anahtarlar ve ham Meta yanıtları kaydedilmez.</p><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Zaman</th><th className="p-2">Kanal</th><th className="p-2">İşlem</th><th className="p-2">Sonuç kodu</th></tr></thead><tbody>{data.logs.map(log => <tr key={log.id} className="border-t"><td className="p-2">{dateText(log.at)}</td><td className="p-2">{CHANNEL_LABELS[log.channel] || 'Genel'}</td><td className="p-2">{labels[log.action] || log.action}</td><td className="p-2">{log.code || log.remoteId || '—'}</td></tr>)}</tbody></table></div>}
    </section>
    {preview && <section role="dialog" aria-modal="true" aria-labelledby="preview-title" className="fixed inset-0 z-50 overflow-auto bg-black/40 p-4"><div className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-6"><div className="flex justify-between"><h2 id="preview-title" className="text-xl font-semibold">Yayın önizlemesi</h2><button onClick={closePreview} className="rounded border px-3 py-1">Kapat</button></div><p>{preview.product.name} · {dateText(preview.scheduledAt)}</p><div className="grid gap-4 sm:grid-cols-2">{preview.channels.map(channel => <div key={channel} className="rounded-lg border p-3"><h3 className="mb-3 font-medium">{CHANNEL_LABELS[channel]}</h3>{/* Authenticated blob or an existing public product image. */}<img alt={`${CHANNEL_LABELS[channel]} yayın görseli`} src={preview.images[channel]} className="max-h-72 w-full object-contain" /><p className="mt-3 whitespace-pre-wrap text-sm">{preview.captions[channel]}</p></div>)}</div>{preview.status === 'pending_approval' && <button disabled={busy} onClick={() => act(async () => { await postApi({ action: 'approve', id: preview.id, revision: preview.revision }); closePreview(); }, 'Görüntülenen yayın onaylandı ve takvime alındı.')} className="rounded-lg bg-green-800 px-5 py-3 text-white">Bu içeriği onayla ve takvime al</button>}</div></section>}
  </main>;
}
