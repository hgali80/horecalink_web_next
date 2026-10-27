'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatSendRejection } from '@/app/lib/whatsappSendFeedback.mjs';

const BUTTON = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs disabled:opacity-40';
export default function FollowupPanel({ conversation, baseIncomingAt, baseRevision, replyRecipient, disabled, readInbox, refreshKey, onContext, onResult, onBusy }) {
  const [taskId, setTaskId] = useState(''), [data, setData] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [permission, setPermission] = useState('granted'), [source, setSource] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [templates, setTemplates] = useState([]), [cursor, setCursor] = useState(null), [loaded, setLoaded] = useState(false), [selected, setSelected] = useState(null), [parameters, setParameters] = useState([]), [reviewed, setReviewed] = useState(false);
  const mounted = useRef(true), guard = useRef(false), requestId = useRef(null), callbacks = useRef({ onContext, onResult, onBusy });
  useEffect(() => { callbacks.current = { onContext, onResult, onBusy }; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { callbacks.current.onBusy(busy); }, [busy]);
  const windowOpen = !!baseIncomingAt && Date.now() >= baseIncomingAt && Date.now() - baseIncomingAt < 86400000;
  const path = `/api/admin/whatsapp/conversations/${conversation.id}/followup`;
  const load = useCallback(async id => {
    setBusy(true); setError(''); setReviewed(false); callbacks.current.onContext({ blocked: true });
    try {
      const result = await readInbox(`${path}?taskId=${encodeURIComponent(id)}`);
      if (!mounted.current) return;
      setData(result); callbacks.current.onContext({ id: result.task.id, revision: result.task.revision, maySend: result.permission.status === 'granted', blocked: false });
    } catch (err) { if (mounted.current) { setData(null); setError(err.message); } }
    finally { if (mounted.current) setBusy(false); }
  }, [path, readInbox]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('followupId');
    if (id && params.get('conversationId') === conversation.id) { setTaskId(id); load(id); }
    else { setTaskId(''); setData(null); callbacks.current.onContext(null); }
  }, [load, refreshKey, conversation.id]);
  useEffect(() => { setReviewed(false); }, [baseIncomingAt, baseRevision, replyRecipient]);
  async function savePermission(event) {
    event.preventDefault(); if (guard.current) return; guard.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await readInbox(path, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'consent', status: permission, source, confirmed, revision: data.permission.revision }) });
      if (!mounted.current) return; setSource(''); setConfirmed(false); setNotice('İletişim izni kaydedildi.'); await load(taskId);
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { guard.current = false; if (mounted.current) setBusy(false); }
  }
  async function loadTemplates(next = null) {
    if (guard.current) return; guard.current = true; setBusy(true); setError('');
    try {
      const result = await readInbox(`/api/admin/whatsapp/templates${next ? `?cursor=${encodeURIComponent(next)}` : ''}`);
      if (!mounted.current) return;
      setTemplates(old => next ? [...new Map([...old, ...result.templates].map(item => [item.id, item])).values()] : result.templates);
      setCursor(result.nextCursor); setLoaded(true); if (!next) { setSelected(null); setReviewed(false); requestId.current = null; }
    } catch (err) { if (mounted.current) setError(err.message); }
    finally { guard.current = false; if (mounted.current) setBusy(false); }
  }
  const text = selected ? [selected.header, selected.body.replace(/\{\{(\d+)\}\}/g, (_, number) => parameters[Number(number) - 1] || `{{${number}}}`), selected.footer].filter(Boolean).join('\n\n') : '';
  const complete = selected && parameters.length === selected.parameterCount && parameters.every(value => value.trim()) && text.length <= 4096;
  const blocked = disabled || busy;
  async function send() {
    if (guard.current || !reviewed || !complete || !data || data.permission.status !== 'granted') return;
    guard.current = true; setBusy(true); setError(''); setNotice('');
    try {
      requestId.current ||= crypto.randomUUID();
      const result = await readInbox(path, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_template', requestId: requestId.current,
        followupId: taskId, followupRevision: data.task.revision, permissionRevision: data.permission.revision, templateId: selected.id, templateName: selected.name, templateLanguage: selected.language,
        templateRevision: selected.revision, parameters, reviewedText: text, reviewed, reviewedRecipient: replyRecipient, baseIncomingAt, baseRevision }) });
      if (!mounted.current) return; setReviewed(false); callbacks.current.onResult(result);
      if (['accepted', 'rejected'].includes(result.state)) requestId.current = null;
      setNotice(result.state === 'accepted' ? 'Şablon gönderimi kabul edildi; teslimat henüz doğrulanmadı. Sonraki takip tarihini görev ekranından belirleyebilirsiniz.' : result.state === 'rejected' ? result.issue || formatSendRejection(result.diagnostics) : 'Gönderim sonucu belirsiz. Yeniden göndermeden önce WhatsApp üzerinden kontrol edin.');
      if (result.state === 'accepted') await load(taskId);
    } catch (err) { if (mounted.current) { setReviewed(false); setError(err.message); } }
    finally { guard.current = false; if (mounted.current) setBusy(false); }
  }
  if (!taskId) return null;
  return <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Müşteri takip mesajı">
    <div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-bold text-slate-900">Takip mesajı hazırlığı</h3>{data && <p className="mt-1 text-xs text-slate-600">{data.task.title}</p>}</div><button type="button" className={BUTTON} disabled={blocked} onClick={() => load(taskId)}>Takibi yenile</button></div>
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}{notice && <p role="status" className="text-xs text-slate-700">{notice}</p>}
    {data && <><p className="text-xs text-slate-600">{windowOpen ? '24 saatlik yanıt süresi açık. Aşağıdaki “Takip mesajı öner” düğmesiyle AI taslağı hazırlayabilirsiniz.' : '24 saatlik yanıt süresi kapalı. AI taslağı planlama için kullanılabilir; müşteriye gönderim için onaylı şablon seçin.'}</p>
      {data.customerRepliedSinceTask && <p className="rounded-lg bg-white p-2 text-xs text-amber-800">Bu görev açıldıktan sonra müşteri yazmış. Hatırlatmadan önce son konuşmayı kontrol edin.</p>}
      {data.task.lastFollowupSentAt && <p className="text-xs text-slate-600">Son takip gönderimi: {new Date(data.task.lastFollowupSentAt).toLocaleString('tr-TR', { timeZone: 'Asia/Qyzylorda' })}. Aynı görevde 24 saat içinde tekrar gönderim engellenir.</p>}
      <details><summary className="cursor-pointer text-xs font-semibold">Takip mesajı izni: {({ granted: 'Kayıtlı', revoked: 'Geri çekilmiş', unknown: 'Henüz kayıtlı değil' })[data.permission.status]}</summary><form className="mt-3 space-y-2" onSubmit={savePermission}><select className="w-full rounded-lg border p-2 text-xs" aria-label="İletişim izni durumu" value={permission} disabled={blocked} onChange={e => { setPermission(e.target.value); setConfirmed(false); }}><option value="granted">Müşteri takip mesajlarına izin verdi</option><option value="revoked">Müşteri takip mesajı istemiyor</option></select><input className="w-full rounded-lg border p-2 text-xs" aria-label="İzin veya iptal kaynağı" placeholder="İzin / iptal kaynağı: ör. tarihli WhatsApp mesajı" required minLength={3} maxLength={500} value={source} disabled={blocked} onChange={e => { setSource(e.target.value); setConfirmed(false); }} /><label className="flex gap-2 text-xs"><input type="checkbox" checked={confirmed} disabled={blocked} onChange={e => setConfirmed(e.target.checked)} />Bu kayıt müşterinin gerçek tercihine dayanıyor; kaydetmeyi onaylıyorum.</label><button className={BUTTON} disabled={blocked || !confirmed}>İzin kaydını güncelle</button></form></details>
      {data.permission.status !== 'granted' && <p className="text-xs text-red-700">Takip gönderimi için müşterinin iletişim iznini kaydedin. AI taslağı hazırlanabilir; kendiliğinden gönderilmez.</p>}
      <div className="space-y-2 border-t border-amber-200 pt-3"><div className="flex flex-wrap gap-2"><button type="button" className={BUTTON} disabled={blocked} onClick={() => loadTemplates()}>Meta’daki onaylı şablonları getir</button>{cursor && <button type="button" className={BUTTON} disabled={blocked} onClick={() => loadTemplates(cursor)}>Daha fazla şablon</button>}</div><p className="text-[11px] text-slate-500">Yalnızca desteklenen metin şablonları listelenir. Şablon kategorisine göre Meta ücreti oluşabilir.</p>
        {loaded && !templates.length && <p className="text-xs text-slate-600">Bu sayfada desteklenen onaylı şablon yok. Meta WhatsApp Manager’da metin şablonunu hazırlayıp onaylatmanız gerekir.</p>}
        {!!templates.length && <select aria-label="Onaylı takip şablonu" className="w-full rounded-lg border p-2 text-xs" disabled={blocked} value={selected?.id || ''} onChange={e => { const value = templates.find(item => item.id === e.target.value) || null; setSelected(value); setParameters(value ? Array(value.parameterCount).fill('') : []); setReviewed(false); requestId.current = null; }}><option value="">Şablon seçin</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name} · {item.language} · {item.category}</option>)}</select>}
        {selected && <>{parameters.map((value, i) => <label className="block text-xs" key={i}>Şablon alanı {i + 1}<input className="mt-1 w-full rounded-lg border p-2" disabled={blocked} required maxLength={200} value={value} onChange={e => { setParameters(old => old.map((item, index) => index === i ? e.target.value : item)); setReviewed(false); requestId.current = null; }} /></label>)}<p className="whitespace-pre-wrap break-words rounded-lg border bg-white p-3 text-sm">{text}</p><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={reviewed} disabled={blocked || !complete || data.permission.status !== 'granted'} onChange={e => setReviewed(e.target.checked)} /><span>Şablon metnini, alanları ve +{conversation.senderId} alıcısını kontrol ettim.{replyRecipient !== conversation.senderId && replyRecipient ? ` Test alıcısı: +${replyRecipient}` : ''}</span></label><button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40" disabled={blocked || !complete || !reviewed || !replyRecipient || data.permission.status !== 'granted' || !data.templateSendEnabled} onClick={send}>İnceledim, şablonu gönder</button>{!data.templateSendEnabled && <p className="text-xs text-slate-600">Şablon gönderimi sunucuda henüz etkinleştirilmedi. Önizleme kullanılabilir.</p>}</>}
      </div>
    </>}
  </section>;
}
