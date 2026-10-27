'use client';

import { useEffect, useRef, useState } from 'react';
import { formatSendRejection } from '@/app/lib/whatsappSendFeedback.mjs';
import { auth } from '@/firebase/index';
import { Languages, Send, Sparkles, ArrowRight, Link2 } from 'lucide-react';
import ProductPicker from './ProductPicker';
import ProductShare from './ProductShare';
import FollowupPanel from './FollowupPanel';

export default function ReplyComposer({ conversation, baseIncomingAt, baseRevision, replyRecipient, onSent, readInbox, suggestedLanguage, suggestion }) {
  const [text, setText] = useState('');
  const [source,setSource] = useState('');
  const [product,setProduct] = useState(null);
  const [shareMode, setShareMode] = useState('text');
  const [card, setCard] = useState(null);
  const [followupContext, setFollowupContext] = useState(null);
  const [followupRefresh, setFollowupRefresh] = useState(0);
  const [followupBusy, setFollowupBusy] = useState(false);
  const serviceWindowOpen = !!baseIncomingAt && Date.now() >= baseIncomingAt && Date.now() - baseIncomingAt < 86400000;
  const isImage = ['image', 'image_link'].includes(shareMode);
  const baseText = text.trim() || (shareMode !== 'text' ? card?.productName || product?.name || '' : '');
  const productUrl = card?.productUrl || product?.url;
  const finalText = ['link', 'image_link'].includes(shareMode) && productUrl && !baseText.includes(productUrl) ? `${baseText}\n\n${productUrl}` : baseText;
  const captionTooLong = isImage && [...finalText].length > 1024;
  const ready = !followupBusy && !followupContext?.blocked && (!followupContext?.id || (followupContext.maySend && serviceWindowOpen)) && !!finalText && finalText.length <= 4096 && !captionTooLong && (!isImage || !!card);
  const languageTouched = useRef(false);
  useEffect(() => { if (!languageTouched.current && ['ru','kk'].includes(suggestedLanguage)) { setLanguage(suggestedLanguage); setCard(null); } },[suggestedLanguage]);
  const [language, setLanguage] = useState('ru');
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [locked, setLocked] = useState(false);
  const requestId = useRef(null);
  const active = useRef(true);
  const guard = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setReviewed(false); }, [baseIncomingAt, baseRevision, replyRecipient, shareMode, card]);
  const edit = value => { setText(value); setReviewed(false); requestId.current = null; setNotice(''); };
  async function action(kind) {
    if (!replyRecipient || guard.current || locked || (kind === 'send' && (!reviewed || !ready))) return;
    guard.current = true; setBusy(true); setNotice('');
    const user = auth.currentUser;
    try {
      if (!user) throw new Error('Oturum açmanız gerekiyor.');
      const token = await user.getIdToken();
      if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti.');
      if (kind === 'send') requestId.current ||= crypto.randomUUID();
      const response = await fetch(`/api/admin/whatsapp/conversations/${conversation.id}/reply`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'draft' ? { action: kind, language, productId:product?.id, ...(followupContext?.id ? { followupId: followupContext.id, followupRevision: followupContext.revision } : {}) } : {
          action: kind, text: finalText, ...(followupContext?.id ? { followupId: followupContext.id, followupRevision: followupContext.revision } : {}), shareMode: isImage ? shareMode : 'text', ...(isImage ? { productId: card.productId, language: card.language, showPrice: card.showPrice, productRevision: card.productRevision, cardRevision: card.cardRevision } : {}), reviewed, requestId: requestId.current, baseIncomingAt, baseRevision, reviewedRecipient: replyRecipient,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'İşlem tamamlanamadı.');
      if (!active.current) return;
      if (kind === 'draft') {
        if (result.baseRevision !== baseRevision) throw new Error('Yeni mesaj var. Önce mesajları yenileyin.');
        if (followupContext?.id && result.followupRevision !== followupContext.revision) throw new Error('Takip değişti. Takip bilgisini yenileyin.');
        edit(result.text);
      } else {
        setReviewed(false);
        setLocked(!['accepted','rejected'].includes(result.state));
        if (result.state === 'accepted') { setText(''); setSource(''); setCard(null); setShareMode('text'); setFollowupRefresh(value => value + 1); requestId.current=null; }
        if (result.state === 'rejected') requestId.current = null;
        setNotice(result.state === 'accepted' ? 'WhatsApp gönderimi kabul etti. Teslim edildiği henüz doğrulanmadı.' : result.state === 'rejected' ? result.issue || formatSendRejection(result.diagnostics) : 'Gönderim sonucu belirsiz veya işlem sürüyor. Tekrar göndermeden önce WhatsApp üzerinden kontrol edin.');
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

  async function translate() {
    if (busy || locked || !source.trim() || guard.current) return;
    guard.current=true; setBusy(true); setNotice('');
    try {
      const result=await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/translate`,undefined,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'compose',text:source,target:language})});
      if (active.current) edit(result.text);
    } catch (err) { if (active.current) setNotice(err.message); }
    finally { guard.current=false; if (active.current) setBusy(false); }
  }
  return <div className="space-y-3">
    <FollowupPanel conversation={conversation} baseIncomingAt={baseIncomingAt} baseRevision={baseRevision} replyRecipient={replyRecipient} disabled={busy || locked} readInbox={readInbox} refreshKey={followupRefresh} onBusy={value => { setFollowupBusy(value); if (value) setReviewed(false); }} onContext={value => { setFollowupContext(value); setReviewed(false); }} onResult={result => { setReviewed(false); setLocked(!['accepted', 'rejected'].includes(result.state)); onSent(); }}/>

    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-800">Yanıt çalışma alanı</h3><div className="flex items-center gap-2"><span className="text-[10px] text-slate-400">Müşterinin dili</span><select aria-label="Yanıt dili" value={language} disabled={busy || locked} onChange={event => { languageTouched.current=true; setLanguage(event.target.value); setCard(null); edit(''); }} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="tr">Türkçe</option><option value="en">English</option></select></div></div>
    <ProductPicker readInbox={readInbox} suggestion={suggestion} selected={product} disabled={busy || locked} onSelect={value => { setProduct(value); setCard(null); setShareMode('text'); setReviewed(false); requestId.current = null; }}/>
    {product && <ProductShare key={`${product.id}:${language}`} product={product} language={language} mode={shareMode} card={card} disabled={busy || locked} readInbox={readInbox} onMode={value => { setShareMode(value); setReviewed(false); requestId.current = null; }} onInvalidate={() => { setCard(null); setReviewed(false); requestId.current = null; }} onPrepared={value => { setCard(value); setReviewed(false); requestId.current = null; }}/>}
    {shareMode !== 'text' && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="mb-1 text-xs font-semibold">Gönderilecek açıklama</p><p className="whitespace-pre-wrap break-words text-sm">{finalText}</p>{isImage && <p className={`mt-2 text-xs ${captionTooLong ? 'text-red-700' : 'text-slate-500'}`}>{[...finalText].length}/1024 karakter · {card ? 'Kart hazır; görseli ve açıklamayı birlikte kontrol edin.' : 'Önce ürün kartını hazırlayın.'}</p>}</div>}
    <div className="grid gap-3 xl:grid-cols-2">
      <div><label htmlFor="reply-source" className="mb-1.5 block text-[11px] font-semibold text-slate-500">Türkçe yazın</label><textarea id="reply-source" aria-label="Çevrilecek Türkçe metin" value={source} maxLength={4096} rows={4} disabled={busy || locked} onChange={event => { setSource(event.target.value); edit(''); }} className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-orange-400" placeholder="Ne söylemek istediğinizi Türkçe yazın…"/><button type="button" disabled={busy || locked || !source.trim()} onClick={translate} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-700 disabled:opacity-40"><Languages size={13}/>{busy?'Hazırlanıyor…':'Seçilen dile çevir'}<ArrowRight size={12}/></button></div>
      <div><label htmlFor="reply-final" className="mb-1.5 block text-[11px] font-semibold text-slate-500">Müşteriye gönderilecek metin</label><textarea id="reply-final" aria-label="Yanıt metni" value={text} maxLength={4096} rows={4} disabled={busy || locked} onChange={event => edit(event.target.value)} className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 outline-none focus:border-blue-400" placeholder="Çeviri burada görünür. Doğrudan da yazabilirsiniz."/><div className="mt-1.5 flex flex-wrap gap-2"><button type="button" disabled={busy || locked || !baseIncomingAt || followupContext?.blocked} onClick={() => action('draft')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-40"><Sparkles size={12}/>{followupContext?.id ? 'Takip mesajı öner' : 'Yanıt öner'}</button>{product && <button type="button" disabled={busy || locked} onClick={() => edit(`${text}${text?'\n\n':''}${product.url}`.slice(0,4096))} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] text-slate-500"><Link2 size={12}/>Ürün bağlantısı ekle</button>}</div></div>
    </div>
    <p className="text-[10px] leading-4 text-slate-400">Çeviri anlamı korur; yanıt önerisi yeni bir taslak üretir. Metinler çeviri/taslak için OpenAI ile paylaşılır. Fiyat, stok ve teslimatı kontrol edin. Kendiliğinden gönderim yapılmaz.</p>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><label className="flex max-w-lg items-start gap-2 text-[11px] leading-5 text-slate-500"><input type="checkbox" checked={reviewed} disabled={busy || locked || !ready} onChange={event => setReviewed(event.target.checked)} className="mt-1 accent-orange-600"/><span>Metni{isImage ? ', ürün kartını' : ''} ve +{conversation.senderId} alıcısını kontrol ettim.{replyRecipient && replyRecipient!==conversation.senderId && <span className="block">Test alıcısı: +{replyRecipient}</span>}</span></label><button type="button" disabled={busy || locked || !replyRecipient || !reviewed || !ready || !baseIncomingAt} onClick={() => action('send')} className="inline-flex items-center gap-2 rounded-xl bg-[#1c354b] px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-35"><Send size={14}/>{busy?'İşleniyor…':'İnceledim, gönder'}</button></div>
    {notice && <p role="status" className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">{notice}</p>}
    {locked && <p className="text-xs text-amber-700">Gönderim sonucu netleşmeden yeni bir yanıt göndermeyin.</p>}
  </div>;
}
