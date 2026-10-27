'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/firebase/index';
import { enableCrmPush, disableCrmPush, listenCrmPush, savedCrmPush } from '@/app/lib/crmPushClient';

const BUTTON = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs disabled:opacity-40';
async function request(path = '', options = {}) {
  const user = auth.currentUser; if (!user) throw new Error('Oturum açmanız gerekiyor.');
  const token = await user.getIdToken(); if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti.');
  const response = await fetch(`/api/admin/crm/notifications${path}`, { ...options, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Bildirim işlemi tamamlanamadı.'); return data;
}
const label = row => row.kind === 'resolved' ? 'Satış nedeniyle tamamlanan takip' : row.kind === 'review' ? 'Kontrol gerektiren takip' : 'Takip zamanı geldi';
const reasons = { customer_replied: 'Müşteri yeniden yazdı; eski hatırlatma duraklatıldı.', permission_revoked: 'Müşteri takip mesajı istemiyor.', source_missing: 'Bağlı görüşme veya teklif bulunamıyor.', sale_confirmed: 'Bağlı satış onaylandı.' };
export default function NotificationCenter() {
  const [rows, setRows] = useState([]), [cursor, setCursor] = useState(null), [automation, setAutomation] = useState(null), [busy, setBusy] = useState(false), [pushBusy, setPushBusy] = useState(false), [enabled, setEnabled] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const mounted = useRef(true), serial = useRef(0);
  const load = useCallback(async (next = null) => {
    const generation = ++serial.current; setBusy(true);
    try { const result = await request(next ? `?cursor=${encodeURIComponent(next)}` : ''); if (!mounted.current || generation !== serial.current) return; setRows(old => next ? [...new Map([...old, ...result.notifications].map(row => [row.id, row])).values()] : result.notifications); setCursor(result.nextCursor); setAutomation(result.automation); setError(''); }
    catch (err) { if (mounted.current && generation === serial.current) { setError(err.message); setRows([]); } }
    finally { if (mounted.current && generation === serial.current) setBusy(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
    if (savedCrmPush()?.uid === auth.currentUser?.uid) {
      setEnabled(true);
      enableCrmPush({ prompt: false }).catch(() => { if (mounted.current) setNotice('Tarayıcı kaydı yenilenemedi. Bildirim ayarını kontrol edin.'); });
    }
    return () => { mounted.current = false; clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true, unsubscribe = () => {};
    listenCrmPush(load).then(stop => { if (alive) unsubscribe = stop; else stop(); }).catch(() => {});
    return () => { alive = false; unsubscribe(); };
  }, [enabled, load]);
  async function toggle() {
    setPushBusy(true); setError(''); setNotice('');
    try { if (enabled) await disableCrmPush(); else await enableCrmPush(); if (mounted.current) { setEnabled(!enabled); setNotice(enabled ? 'Bu tarayıcıda bildirim kapatıldı.' : 'Bu tarayıcı bildirim için kaydedildi. Arka plan kontrolü çalıştığında uyarı gelebilir.'); } }
    catch (err) { if (mounted.current) setError(err.message); }
    finally { if (mounted.current) { if (!savedCrmPush()) setEnabled(false); setPushBusy(false); } }
  }
  async function markRead(row) {
    try { await request('', { method: 'PATCH', body: JSON.stringify({ id: row.id }) }); if (mounted.current) setRows(old => old.map(item => item.id === row.id ? { ...item, status: 'read' } : item)); }
    catch (err) { if (mounted.current) setError(err.message); }
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Takip bildirimleri">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Takip bildirimleri</h2><p className="text-xs text-slate-500">Yüklenen bildirimlerde {rows.filter(row => row.status === 'unread').length} okunmamış · Yalnızca size ait bildirimler.</p></div><div className="flex flex-wrap gap-2"><button className={BUTTON} disabled={pushBusy} onClick={toggle}>{pushBusy ? 'İşleniyor…' : enabled ? 'Bu tarayıcıda bildirimi kapat' : 'Tarayıcı bildirimini aç'}</button><button className={BUTTON} disabled={busy} onClick={() => load()}>Yenile</button></div></div>
    {automation && <p className="text-xs text-slate-500">{!automation.enabled ? 'Arka plan kontrolü sunucuda henüz etkin değil.' : automation.lastCompletedAt ? `Son tamamlanan kontrol: ${new Date(automation.lastCompletedAt).toLocaleString('tr-TR', { timeZone: 'Asia/Qyzylorda' })}${automation.more ? ' · Diğer görevler sonraki kontrolde taranacak.' : ''}` : 'Arka plan kontrolü henüz çalışmamış.'}{automation.lastFailedAt && (!automation.lastCompletedAt || automation.lastFailedAt > automation.lastCompletedAt) ? ' Son kontrolde hata oluştu; zamanlayıcıyı kontrol edin.' : ''}{automation.errors ? ` ${automation.errors} görev kontrol edilemedi; sonraki taramada yeniden değerlendirilecek.` : ''}</p>}
    <p className="text-[11px] text-slate-500">Tarayıcı uyarıları müşteri adı veya mesaj içermez. Teslim, cihazın bildirim ve güç ayarlarına bağlıdır. Takip listesi esas kayıttır.</p>
    {notice && <p role="status" className="text-xs text-green-700">{notice}</p>}{error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    <div className="max-h-64 space-y-2 overflow-y-auto">{rows.map(row => <article key={row.id} className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 ${row.status === 'unread' ? 'border-blue-200 bg-blue-50' : 'border-slate-100'}`}><div><Link href={`/satissitok/admin/crm?taskId=${encodeURIComponent(row.taskId)}`} className="text-sm font-semibold text-blue-800">{label(row)}</Link><p className="text-xs text-slate-600">{reasons[row.reason] || 'Müşteriyle yapılacak sonraki işlemi kontrol edin.'}</p></div>{row.status === 'unread' && <button className={BUTTON} onClick={() => markRead(row)}>Okundu</button>}</article>)}</div>
    {!busy && !rows.length && <p className="text-xs text-slate-500">Henüz bildirim yok.</p>}{cursor && <button className={BUTTON} disabled={busy} onClick={() => load(cursor)}>Daha fazla bildirim</button>}
  </section>;
}
