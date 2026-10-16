'use client';

import { useEffect, useRef, useState } from 'react';
import { formatSendRejection } from '@/app/lib/whatsappSendFeedback.mjs';
import { auth } from '@/firebase/index';

export default function ReplyComposer({ conversation, baseIncomingAt, baseRevision, onSent }) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('ru');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [locked, setLocked] = useState(false);
  const requestId = useRef(null);
  const active = useRef(true);
  const guard = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setReviewed(false); }, [baseIncomingAt, baseRevision]);
  const edit = value => { setText(value); setReviewed(false); requestId.current = null; setNotice(''); };
  async function action(kind) {
    if (guard.current || locked || (kind === 'send' && !reviewed)) return;
    guard.current = true; setBusy(true); setNotice('');
    const user = auth.currentUser;
    try {
      if (!user) throw new Error('Oturum açmanız gerekiyor.');
      const token = await user.getIdToken();
      if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti.');
      if (kind === 'send') requestId.current ||= crypto.randomUUID();
      const response = await fetch(`/api/admin/whatsapp/conversations/${conversation.id}/reply`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'draft' ? { action: kind, language } : {
          action: kind, text, reviewed, requestId: requestId.current, baseIncomingAt, baseRevision,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
      if (!active.current) return;
      if (kind === 'draft') {
        if (result.baseRevision !== baseRevision) throw new Error('Yeni mesaj var. Önce mesajları yenileyin.');
        edit(result.text);
      } else {
        setReviewed(false);
        setLocked(result.state !== 'rejected');
        if (result.state === 'rejected') requestId.current = null;
        setNotice(result.state === 'accepted' ? 'WhatsApp gönderimi kabul etti. Teslim edildiği henüz doğrulanmadı.' : result.state === 'rejected' ? formatSendRejection(result.diagnostics) : 'Gönderim sonucu belirsiz veya işlem sürüyor. Tekrar göndermeden önce WhatsApp üzerinden kontrol edin.');
        onSent();
      }
    } catch (error) {
      if (active.current) {
        setNotice(error.message);
        // Preserve the request ID after transport failure; retries use the same durable record.
        if (kind === 'send') setReviewed(false);
      }
    } finally { guard.current = false; if (active.current) setBusy(false); }
  }
  return <div className="mt-5 space-y-3 border-t pt-4">
    <h3 className="font-semibold">Yanıt hazırlayın</h3>
    <div className="flex flex-wrap gap-2">
      <select aria-label="Yanıt dili" value={language} disabled={busy || locked} onChange={event => { setLanguage(event.target.value); setReviewed(false); }} className="rounded-lg border p-2">
        <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="tr">Türkçe</option><option value="en">English</option>
      </select>
      <button type="button" disabled={busy || locked || !baseIncomingAt} onClick={() => action('draft')} className="rounded-lg border px-3 py-2 disabled:opacity-50">Taslak hazırla</button>
    </div>
    <p className="text-xs text-slate-600">Taslak için son mesajların sınırlı bir bölümü OpenAI ile paylaşılır. Taslağın dilini, fiyatları ve tüm bilgileri kontrol edin. Mesaj kendiliğinden gönderilmez.</p>
    <textarea aria-label="Yanıt metni" value={text} maxLength={4096} rows={5} disabled={busy || locked} onChange={event => edit(event.target.value)} className="w-full rounded-lg border p-3" placeholder="Yanıtınızı yazın veya taslak hazırlayın." />
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy || locked || !text.trim()} onChange={event => setReviewed(event.target.checked)} /> <span>Metni inceledim; bu yanıtın +{conversation.senderId} numarasına gönderilmesini onaylıyorum.</span></label>
    <button type="button" disabled={busy || locked || !reviewed || !text.trim() || !baseIncomingAt} onClick={() => action('send')} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'İşleniyor…' : 'Onayladığım yanıtı gönder'}</button>
    {notice && <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">{notice}</p>}
    {locked && <p className="text-xs text-slate-600">Yeni bir yanıt için konuşmayı yeniden açın. Sonucu belirsiz gönderimler sunucuda tekrar gönderime kapatılır.</p>}
  </div>;
}
