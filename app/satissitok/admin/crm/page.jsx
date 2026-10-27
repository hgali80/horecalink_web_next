'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { auth } from '@/firebase/index';
import { useAuth } from '@/app/context/AuthContext';
import { taskBucket, ZONE } from '@/app/lib/crmFollowups.mjs';
import NotificationCenter from './NotificationCenter';

const KINDS = { offer: 'Teklif sonrası takip', silent: 'Bilgi sonrası dönüş bekleniyor', callback: 'Planlı görüşme' };
const FIELD = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const BUTTON = 'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50';
const EMPTY = { title: '', customerName: '', phone: '', notes: '', kind: 'callback', customerId: '', offerId: '', conversationId: '', due: '' };
const displayDate = value => new Intl.DateTimeFormat('tr-TR', { timeZone: ZONE, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function localInput(value) {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
  return parts.replace(' ', 'T');
}
function toISO(value) {
  if (!value) throw new Error('Takip tarihini seçin.');
  // The displayed input is explicitly Kazakhstan time, independent of the browser's timezone.
  return new Date(`${value}:00+05:00`).toISOString();
}
async function api(path = '', options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Oturum açmanız gerekiyor.');
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti.');
  const response = await fetch(`/api/admin/crm/followups${path}`, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
  return result;
}

export default function FollowupsPage() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6">Yükleniyor…</p>;
  if (!user || !['admin', 'super_admin'].includes(user.role)) return <p className="p-6">Bu alan için yönetici oturumu gerekli.</p>;
  return <Workspace key={user.uid} />;
}

function Workspace() {
  const [form, setForm] = useState(EMPTY);
  const [tasks, setTasks] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState('open');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sourceBusy, setSourceBusy] = useState(true);
  const [sourceError, setSourceError] = useState('');
  const [sourceLabels, setSourceLabels] = useState({});
  const [picker, setPicker] = useState('');
  const [editing, setEditing] = useState(null);
  const [newDue, setNewDue] = useState('');
  const [now, setNow] = useState(() => new Date());
  const generation = useRef(0), saving = useRef(false), creationId = useRef(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (next = null) => {
    const revision = ++generation.current;
    setBusy(true); setError('');
    try {
      const focused = new URLSearchParams(window.location.search).get('taskId');
      const result = await api(focused ? `?id=${encodeURIComponent(focused)}` : `?status=${status}${next ? `&cursor=${encodeURIComponent(next)}` : ''}`);
      if (!mounted.current || revision !== generation.current) return;
      setTasks(old => next ? [...new Map([...old, ...result.tasks].map(task => [task.id, task])).values()] : result.tasks);
      setCursor(result.nextCursor);
    } catch (err) { if (mounted.current && revision === generation.current) { setError(err.message); setTasks([]); setCursor(null); } }
    finally { if (mounted.current && revision === generation.current) setBusy(false); }
  }, [status]);
  useEffect(() => { setTasks([]); setCursor(null); load(); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const type = params.get('sourceType'), id = params.get('sourceId');
    if (!type && !id) { setSourceBusy(false); return; }
    if (!['offer', 'customer', 'conversation'].includes(type) || !id) { setSourceError('Başlangıç bağlantısı geçersiz.'); setSourceBusy(false); return; }
    api(`?sourceType=${encodeURIComponent(type)}&sourceId=${encodeURIComponent(id)}`).then(result => {
      if (!alive) return;
      setSourceLabels({ [type]: result.label });
      setForm(old => ({ ...old, customerName: result.customerName, phone: result.phone,
        [`${type === 'customer' ? 'customer' : type}Id`]: id, kind: type === 'offer' ? 'offer' : 'callback',
        title: type === 'offer' ? `${result.label} — teklif takibi` : `${result.customerName} — müşteri takibi` }));
    }).catch(err => { if (alive) setSourceError(err.message); }).finally(() => { if (alive) setSourceBusy(false); });
    return () => { alive = false; };
  }, []);
  const update = (key, value) => { creationId.current = null; setForm(old => ({ ...old, [key]: value })); };
  async function create(event) {
    event.preventDefault(); if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      creationId.current ||= crypto.randomUUID();
      await api('', { method: 'POST', body: JSON.stringify({ ...form, id: creationId.current, dueAt: toISO(form.due) }) });
      if (!mounted.current) return;
      creationId.current = null; setForm(EMPTY); setSourceLabels({}); setNotice('Takip kaydedildi. Müşteriye mesaj gönderilmedi.');
      await load();
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  async function change(task, action) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await api('', { method: 'PATCH', body: JSON.stringify({ id: task.id, revision: task.revision, action,
        ...(['reschedule', 'reopen'].includes(action) ? { dueAt: toISO(newDue) } : {}) }) });
      if (!mounted.current) return;
      setEditing(null); setNotice('Takip güncellendi.'); await load();
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  const counts = { today: 0, overdue: 0, upcoming: 0 };
  tasks.forEach(task => { const bucket = taskBucket(task, now); if (bucket in counts) counts[bucket]++; });
  const visible = tasks.filter(task => (filter === 'all' || taskBucket(task, now) === filter) &&
    `${task.title} ${task.customerName} ${task.phone} ${task.labels?.offer || ''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  return <main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">Müşteri Takibi</h1><p className="mt-1 text-sm text-slate-500">Teklifleri ve geri dönüşleri zamanında takip edin.</p></div><div className="flex gap-2"><Link className={BUTTON} href="/admin/whatsapp">WhatsApp</Link><Link className={BUTTON} href="/satissitok/admin">Yönetim paneli</Link></div></header>
    <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">Takipler panelden yönetilir; izin verdiğiniz tarayıcıya bildirim gönderilebilir. Müşteriye kendiliğinden mesaj gönderilmez. Saatler Kazakistan saatidir (UTC+5).</p>
    <NotificationCenter />
    <Link className="inline-block text-xs text-blue-700" href="/satissitok/admin/crm">Tüm takipleri göster</Link>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-3">{[['today', 'Bugünkü takipler'], ['overdue', 'Geciken takipler'], ['upcoming', 'Yaklaşan takipler']].map(([key, label]) => <button key={key} disabled={status !== 'open' || busy} onClick={() => setFilter(key)} className={`rounded-2xl border p-5 text-left ${filter === key ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}><span className="block text-sm text-slate-600">{label}</span><strong className="mt-2 block text-3xl">{counts[key]}</strong></button>)}</div>
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">Yeni takip</h2>
        {sourceError && <p role="alert" className="mb-3 text-sm text-red-700">{sourceError} Bağlantıyı kontrol ederek yeniden açın veya <Link className="underline" href="/satissitok/admin/crm">bağlantısız yeni takip açın</Link>.</p>}
        <form onSubmit={create} className="space-y-3"><fieldset disabled={busy || sourceBusy || !!sourceError} className="space-y-3 disabled:opacity-60">
          <label className="block text-sm">Takip konusu<input className={FIELD} required maxLength={160} value={form.title} onChange={e => update('title', e.target.value)} /></label>
          <label className="block text-sm">Müşteri / firma<input className={FIELD} required maxLength={160} value={form.customerName} onChange={e => update('customerName', e.target.value)} /></label>
          <label className="block text-sm">Telefon<input className={FIELD} type="tel" maxLength={40} value={form.phone} onChange={e => update('phone', e.target.value)} /></label>
          <label className="block text-sm">Takip nedeni<select className={FIELD} value={form.kind} onChange={e => update('kind', e.target.value)}>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="block text-sm">Tarih ve saat (Kazakistan)<input className={FIELD} type="datetime-local" required value={form.due} onChange={e => update('due', e.target.value)} /></label>
          <label className="block text-sm">Not<textarea className={FIELD} rows={3} maxLength={2000} value={form.notes} onChange={e => update('notes', e.target.value)} /></label>
          <div className="space-y-2 text-sm"><p className="font-medium">Bağlı kayıtlar</p>{[['customer', 'Müşteri / cari'], ['offer', 'Ticari teklif'], ['conversation', 'WhatsApp görüşmesi']].map(([type, label]) => <div key={type} className="rounded-lg border p-2"><span className="block text-xs text-slate-500">{label}</span><span className="block break-words">{sourceLabels[type] || (form[`${type}Id`] ? 'Bağlı kayıt' : 'Bağlanmadı')}</span><button type="button" className="mr-3 text-xs text-blue-700" onClick={() => setPicker(type)}>Seç</button>{form[`${type}Id`] && <button type="button" className="text-xs text-slate-500" onClick={() => { update(`${type}Id`, ''); setSourceLabels(old => ({ ...old, [type]: '' })); }}>Bağlantıyı kaldır</button>}</div>)}<p className="text-xs text-slate-500">Seçtiğiniz kayıtların aynı müşteriye ait olduğunu kontrol edin.</p></div>
          <button className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" type="submit">{sourceBusy ? 'Bağlantı yükleniyor…' : 'Takibi kaydet'}</button>
        </fieldset></form>
        {picker && <RecordPicker key={picker} type={picker} onClose={() => setPicker('')} onSelect={record => { update(`${picker}Id`, record.id); setSourceLabels(old => ({ ...old, [picker]: record.label })); setForm(old => ({ ...old, customerName: old.customerName || record.customerName, phone: old.phone || record.phone })); setPicker(''); }} />}
      </section>
      <section className="space-y-3"><div className="flex flex-wrap gap-2"><select aria-label="Görev durumu" className={BUTTON} disabled={busy} value={status} onChange={e => { setStatus(e.target.value); setFilter('all'); }}><option value="open">Açık takipler</option><option value="paused">Kontrol bekleyenler</option><option value="completed">Tamamlananlar</option><option value="cancelled">İptal edilenler</option></select><select aria-label="Takip zamanı" className={BUTTON} value={filter} disabled={status !== 'open'} onChange={e => setFilter(e.target.value)}><option value="all">Tüm tarihler</option><option value="today">Bugün</option><option value="overdue">Geciken</option><option value="upcoming">Yaklaşan</option></select><button className={BUTTON} disabled={busy} onClick={() => load()}>Yenile</button><input aria-label="Yüklenen takiplerde ara" className={`${FIELD} flex-1`} placeholder="Müşteri, telefon veya teklif ara" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <p className="text-xs text-slate-500">{tasks.length} kayıt yüklendi. Sayaçlar ve arama yüklenen kayıtları kapsar.{cursor ? ' Diğer kayıtlar için daha fazla yükleyin.' : ''} Liste yenilendiğinde güncel kayıtlar alınır.</p>
        {busy && <p role="status">İşlem yapılıyor…</p>}
        {!busy && !visible.length && <p className="rounded-2xl border border-dashed p-10 text-center text-slate-500">Bu görünümde takip bulunamadı.</p>}
        {visible.map(task => <article key={task.id} className="space-y-3 rounded-2xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-semibold text-slate-900">{task.title}</h2><p className="text-sm text-slate-600">{task.customerName}{task.phone ? ` · ${task.phone}` : ''}</p></div><span className={`h-fit rounded-lg px-2 py-1 text-xs ${taskBucket(task, now) === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{displayDate(task.dueAt)}</span></div>
          <p className="text-xs text-slate-500">{KINDS[task.kind]} · {task.status === 'open' ? 'Açık' : task.status === 'completed' ? 'Tamamlandı' : task.status === 'paused' ? 'Kontrol bekliyor' : 'İptal edildi'}</p>
          {task.automationReason && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{({customer_replied:'Müşteri yeniden yazdığı için eski hatırlatma duraklatıldı.',permission_revoked:'Takip mesajı izni geri çekilmiş.',source_missing:'Bağlı kayıt bulunamadı; bağlantıları kontrol edin.',sale_confirmed:'Bağlı satış onaylandığı için takip tamamlandı.'})[task.automationReason]}</p>}
          {task.notes && <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{task.notes}</p>}
          <div className="flex flex-wrap gap-3 text-sm text-blue-700">{task.conversationId && <Link href={`/admin/whatsapp?conversationId=${encodeURIComponent(task.conversationId)}&followupId=${encodeURIComponent(task.id)}`}>Takip mesajı hazırla</Link>}{task.offerId && <Link href={`/satissitok/admin/commercial-offers/${encodeURIComponent(task.offerId)}`}>{task.labels?.offer || 'Teklifi aç'}</Link>}{task.customerId && <Link href={`/satissitok/admin/erp/caris/${encodeURIComponent(task.customerId)}`}>Müşteri kartı</Link>}</div>
          <div className="flex flex-wrap gap-2">{task.status === 'open' && <><button className={BUTTON} disabled={busy} onClick={() => change(task, 'complete')}>Tamamlandı</button><button className={BUTTON} disabled={busy} onClick={() => change(task, 'cancel')}>İptal et</button></>}<button className={BUTTON} disabled={busy} onClick={() => { setEditing(task.id); setNewDue(localInput(task.dueAt)); }}>{task.status === 'open' ? 'Tarihi değiştir' : 'Yeniden aç'}</button></div>
          {editing === task.id && <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); change(task, task.status === 'open' ? 'reschedule' : 'reopen'); }}><label className="text-sm">Yeni tarih (Kazakistan)<input className={FIELD} type="datetime-local" required value={newDue} onChange={e => setNewDue(e.target.value)} /></label><button className={BUTTON} disabled={busy}>Kaydet</button><button className={BUTTON} type="button" onClick={() => setEditing(null)}>Vazgeç</button></form>}
        </article>)}
        {cursor && <button disabled={busy} className={BUTTON} onClick={() => load(cursor)}>50 kayıt daha yükle</button>}
      </section>
    </div>
  </main>;
}

function RecordPicker({ type, onClose, onSelect }) {
  const [rows, setRows] = useState([]), [cursor, setCursor] = useState(null), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const active = useRef(true);
  const load = useCallback(async next => {
    setBusy(true); setError('');
    try { const result = await api(`?options=${type}${next ? `&cursor=${encodeURIComponent(next)}` : ''}`); if (active.current) { setRows(old => next ? [...old, ...result.options] : result.options); setCursor(result.nextCursor); } }
    catch (err) { if (active.current) setError(err.message); }
    finally { if (active.current) setBusy(false); }
  }, [type]);
  useEffect(() => { active.current = true; load(null); return () => { active.current = false; }; }, [load]);
  return <section className="mt-4 space-y-2 rounded-xl border border-blue-200 bg-blue-50 p-3" aria-label="Bağlanacak kaydı seç"><div className="flex justify-between"><strong className="text-sm">Kayıt seç</strong><button type="button" onClick={onClose}>Kapat</button></div><input className={FIELD} aria-label="Yüklenen kayıtlarda ara" placeholder="Yüklenen kayıtlarda ara" value={query} onChange={e => setQuery(e.target.value)} />{error && <p role="alert" className="text-sm text-red-700">{error}<button type="button" onClick={() => load(null)}> Yeniden dene</button></p>}<ul className="max-h-64 space-y-1 overflow-auto">{rows.filter(row => `${row.label} ${row.customerName} ${row.phone}`.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR'))).map(row => <li key={row.id}><button type="button" className="w-full rounded-lg bg-white p-2 text-left text-sm" disabled={busy} onClick={() => onSelect(row)}><span className="block font-medium">{row.label}</span><span className="text-xs text-slate-500">{row.customerName} {row.phone}</span></button></li>)}</ul><p className="text-xs text-slate-500">{busy ? 'Yükleniyor…' : `${rows.length} kayıt yüklendi. Arama yüklenen kayıtları kapsar.`}</p>{cursor && <button type="button" className={BUTTON} disabled={busy} onClick={() => load(cursor)}>Daha fazla yükle</button>}</section>;
}
