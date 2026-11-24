'use client';

import { useEffect, useMemo, useState } from 'react';
import { auth } from '@/firebase/index';

const ALMATY = 'Asia/Almaty';
const toInput = value => new Date(new Date(value).getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
const fromInput = value => Date.parse(`${value}:00+05:00`);
const display = value => value ? new Intl.DateTimeFormat('tr-TR', { timeZone: ALMATY, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function ScheduledSend({ conversation, baseIncomingAt, baseRevision, replyRecipient, text, readInbox, imageMode = false, open, onOpenChange }) {
  const [plans, setPlans] = useState([]), [templates, setTemplates] = useState([]), [cursor, setCursor] = useState(null);
  const [template, setTemplate] = useState(null), [parameters, setParameters] = useState([]);
  const [scheduledAt, setScheduledAt] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reviewed, setReviewed] = useState(false);
  const preview = useMemo(() => template ? [template.header, template.body.replace(/\{\{(\d+)\}\}/g, (_, n) => parameters[Number(n) - 1] || `{{${n}}}`), template.footer].filter(Boolean).join('\n\n') : text, [template, parameters, text]);
  const at = fromInput(scheduledAt), baseWindowEnds = baseIncomingAt + 86400000;
  const needsTemplate = kind === 'template' || !baseIncomingAt || at >= baseWindowEnds;
  async function loadPlans() {
    try { const result = await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/scheduled`); setPlans(result.schedules || []); } catch (e) { setError(e.message); }
  }
  useEffect(() => { loadPlans(); }, [conversation.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try { const result = await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/scheduled`); setPlans(result.schedules || []); } catch { /* A manual refresh reports failures. */ }
    }, 20000);
    return () => clearInterval(timer);
  }, [conversation.id, readInbox]);
  useEffect(() => { if (open) { setScheduledAt(toInput(Date.now() + 3600000)); setReviewed(false); setError(''); } }, [open]);
  async function loadTemplates() {
    try {
      const result = await readInbox(`/api/admin/whatsapp/templates${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
      setTemplates(old => cursor ? [...old, ...result.templates] : result.templates); setCursor(result.nextCursor);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (needsTemplate && !templates.length && !busy) loadTemplates(); }, [needsTemplate]); // eslint-disable-line react-hooks/exhaustive-deps
  function tomorrowEleven() {
    const now = new Date(), local = new Date(now.getTime() + 5 * 3600000);
    local.setUTCDate(local.getUTCDate() + 1); local.setUTCHours(11, 0, 0, 0);
    setScheduledAt(local.toISOString().slice(0, 16)); setReviewed(false);
  }
  const user = auth.currentUser;
  async function mutate(body) {
    if (!user) throw new Error('Oturum açmanız gerekiyor.');
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/whatsapp/conversations/${conversation.id}/scheduled`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Plan kaydedilemedi.'); return result;
  }
  async function save() {
    setBusy(true); setError('');
    try {
      if (!reviewed || !replyRecipient || !text.trim() || !Number.isFinite(at)) throw new Error('Alıcıyı, önizlemeyi ve Almatı saatini kontrol edip onaylayın.');
      const body = { action: 'create', kind: needsTemplate ? 'template' : 'text', text: preview, scheduledAt: at, baseIncomingAt, baseRevision, reviewedRecipient: replyRecipient, reviewed: true,
        ...(needsTemplate && template ? { templateId: template.id, templateName: template.name, templateLanguage: template.language, templateRevision: template.revision, parameters } : {}) };
      await mutate(body); onOpenChange(false); setReviewed(false); await loadPlans();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function cancel(id) { setBusy(true); setError(''); try { await mutate({ action: 'cancel', id }); await loadPlans(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function editTime(plan) { const value = window.prompt('Yeni Almatı gönderim zamanı (YYYY-MM-DDTHH:mm)', toInput(plan.scheduledAt)); if (!value) return; setBusy(true); setError(''); try { await mutate({ action: 'update', id: plan.id, scheduledAt: fromInput(value) }); await loadPlans(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  async function editText(plan) {
    setBusy(true); setError('');
    try {
      if (plan.kind === 'template' && plan.template) {
        let cursor = null, selected = null;
        for (let page = 0; page < 20 && !selected; page++) {
          const result = await readInbox(`/api/admin/whatsapp/templates${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
          selected = result.templates.find(item => item.id === plan.template.id && item.name === plan.template.name && item.language === plan.template.language);
          cursor = result.nextCursor; if (!cursor) break;
        }
        if (!selected) throw new Error('Şablon listede bulunamadı. Planı iptal edip onaylı şablonla yeniden oluşturun.');
        const parameters = [];
        for (let index = 0; index < selected.parameterCount; index++) {
          const value = window.prompt(`Şablon alanı ${index + 1}`, plan.template.parameters[index] || '');
          if (value === null || !value.trim()) return;
          parameters.push(value);
        }
        const preview = [selected.header, selected.body.replace(/\{\{(\d+)\}\}/g, (_, number) => parameters[Number(number) - 1]), selected.footer].filter(Boolean).join('\n\n');
        if (!window.confirm(`Alıcı: +${plan.recipient || conversation.senderId}\nGönderim: ${display(plan.scheduledAt)}\n\n${preview}\n\nBu son şablon metnini kaydedeyim mi?`)) return;
        await mutate({ action: 'update', id: plan.id, scheduledAt: Date.parse(plan.scheduledAt), parameters });
      } else {
        const value = window.prompt('Düzenlenmiş son mesaj metni', plan.text);
        if (value === null || !value.trim()) return;
        await mutate({ action: 'update', id: plan.id, scheduledAt: Date.parse(plan.scheduledAt), text: value });
      }
      await loadPlans();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3" aria-label="Zamanlanmış WhatsApp gönderimleri">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-xs font-bold text-slate-800">Zamanlanmış mesajlar</h4><p className="text-[10px] text-slate-500">Almatı saati (UTC+5) · Sunucuda UTC</p></div></div>
    {imageMode && <p className="mt-2 text-[10px] text-amber-700">Görsel ürün kartı zamanlanamaz. Kartı ayrı olarak şimdi gönderebilirsiniz.</p>}
    {open && <div className="mt-3 space-y-2 rounded-lg border border-sky-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={tomorrowEleven} className="rounded-lg border px-2.5 py-1.5 text-[11px]">Yarın 11.00</button><label className="text-[11px] text-slate-600">Özel Almatı zamanı <input aria-label="Özel Almatı gönderim zamanı" type="datetime-local" value={scheduledAt} onChange={e => { setScheduledAt(e.target.value); setReviewed(false); }} className="ml-2 rounded-lg border p-1.5" /></label></div>
      {needsTemplate && <><label className="block text-[11px] font-semibold">24 saatlik pencere bu saatte kapalı; Meta onaylı şablon seçin<select className="mt-1 w-full rounded-lg border p-2 text-xs" value={template?.id || ''} onChange={e => { const selected = templates.find(item => item.id === e.target.value); setTemplate(selected || null); setParameters(selected ? Array(selected.parameterCount).fill('') : []); setReviewed(false); }}><option value="">Şablon seçin</option>{templates.map(item => <option key={item.id} value={item.id}>{item.name} · {item.language} · {item.category}</option>)}</select></label>{cursor && <button type="button" onClick={loadTemplates} className="text-[10px] text-blue-700">Daha fazla şablon</button>}{template && parameters.map((value,index) => <input key={index} aria-label={`Şablon alanı ${index+1}`} maxLength={200} value={value} onChange={e => { setParameters(old => old.map((x,i) => i===index ? e.target.value : x)); setReviewed(false); }} className="w-full rounded-lg border p-2 text-xs" placeholder={`Şablon alanı ${index+1}`} />)}</>}
      <p className="text-[10px] text-slate-500">Alıcı: +{conversation.senderId} {replyRecipient !== conversation.senderId ? `(Meta test alıcısı +${replyRecipient})` : ''}</p><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-xs text-slate-700">{preview || 'Gönderilecek metin yok.'}</p><p className="text-[11px] font-semibold text-sky-800">Gönderim: {display(at)}</p>
      {needsTemplate && <p className="text-[10px] text-amber-700">Gönderim anında şablon onayı ve kayıtlı müşteri izni yeniden kontrol edilir.</p>}
      <label className="flex gap-2 text-[10px] text-slate-600"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />Alıcıyı, son metni ve gönderim saatini inceledim.</label>
      <button type="button" disabled={busy || !reviewed || (needsTemplate && (!template || parameters.some(value => !value.trim())))} onClick={save} className="rounded-lg bg-[#1c354b] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? 'Kaydediliyor…' : 'Planı kaydet'}</button><button type="button" onClick={() => onOpenChange(false)} className="ml-2 text-xs text-slate-500">Vazgeç</button>
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {!!plans.length && <ul className="mt-2 space-y-2">{plans.map(plan => <li key={plan.id} className="rounded-lg border border-white bg-white p-2 text-[10px]"><div className="flex justify-between gap-2"><strong>{({scheduled:'Planlandı',sending:'Gönderim başlıyor',submitting:'WhatsApp isteği gönderiliyor',accepted:'WhatsApp kabul etti',rejected:'WhatsApp reddetti',unknown:'Gönderim doğrulanamadı',cancelled:'İptal edildi'})[plan.status] || plan.status} · {display(plan.scheduledAt)}</strong>{plan.status === 'scheduled' && <span className="flex gap-2"><button disabled={busy} onClick={() => editText(plan)} className="text-blue-700 underline">Metni düzenle</button><button disabled={busy} onClick={() => editTime(plan)} className="text-blue-700 underline">Saati değiştir</button><button disabled={busy} onClick={() => cancel(plan.id)} className="text-red-700 underline">İptal</button></span>}</div><p className="mt-1 whitespace-pre-wrap text-slate-600">{plan.text}</p>{plan.cancelReason && <p className="mt-1 font-semibold text-amber-800">Neden: {plan.cancelReason}</p>}{plan.sendIssue && <p className="mt-1 text-red-700">{plan.sendIssue}</p>}{plan.status === 'accepted' && <p className="mt-1 text-slate-500">WhatsApp isteği kabul etti{plan.deliveryStatus ? ` · ${({sent:'Gönderildi',delivered:'Teslim edildi',read:'Okundu',failed:'Teslim edilemedi'})[plan.deliveryStatus] || plan.deliveryStatus}` : '; teslim durumu henüz doğrulanmadı.'}</p>}</li>)}</ul>}
  </section>;
}
