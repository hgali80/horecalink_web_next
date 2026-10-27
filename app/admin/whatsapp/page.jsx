'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { auth } from '@/firebase/index';
import { formatSendRejection } from '@/app/lib/whatsappSendFeedback.mjs';
import ReplyComposer from './ReplyComposer';
import ConnectionStatus from './ConnectionStatus';
import { MessageSquare, Search, RefreshCw, ChevronDown, ArrowLeft, Smartphone, Check, Languages } from 'lucide-react';

async function readInbox(path, signal, options = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Oturum açmanız gerekiyor.');
  const token = await currentUser.getIdToken();
  if (auth.currentUser?.uid !== currentUser.uid) throw new Error('Oturum değişti. Sayfayı yenileyin.');
  const response = await fetch(path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, cache: 'no-store', signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Mesajlar alınamadı.');
  return result;
}

export default function WhatsAppPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = user?.role === 'admin' || user?.role === 'super_admin';
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);
  if (loading) return <div className="p-6">Yükleniyor...</div>;
  if (!user) return null;
  if (!allowed) return <div className="p-6">Bu alana erişim yetkiniz yok.</div>;
  return <WhatsAppInbox key={user.uid} />;
}


const merge = (old, rows) => [...new Map([...old,...rows].map(item => [item.id,item])).values()];
const time = value => value ? new Date(value).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : '';

function WhatsAppInbox() {
  const [conversations,setConversations] = useState([]);
  const [cursor,setCursor] = useState(null);
  const [selected,setSelected] = useState(null);
  const [search,setSearch] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [settings,setSettings] = useState(false);
  const controller = useRef(null);
  const cache = useRef(new Map());
  const listRevision = useRef(null);
  const load = useCallback(async (nextCursor = null) => {
    if (controller.current) return;
    const request = new AbortController(); controller.current=request;
    setBusy(true); setError('');
    try {
      const result = await readInbox(`/api/admin/whatsapp/conversations${nextCursor ? `?cursor=${nextCursor}` : ''}`,request.signal);
      if (request.signal.aborted) return;
      setConversations(old => nextCursor ? merge(old,result.conversations) : result.conversations); setCursor(result.nextCursor);
      if (!nextCursor) listRevision.current=result.revision;
    } catch (err) { if (!request.signal.aborted) { setError(err.message); setConversations([]); setSelected(null); cache.current.clear(); } }
    finally { if (controller.current === request) controller.current=null; if (!request.signal.aborted) setBusy(false); }
  },[]);
  useEffect(() => { load(); return () => { controller.current?.abort(); controller.current=null; }; },[load]);
  useEffect(() => {
    const request = new AbortController();
    const timer = setInterval(async () => {
      if (document.hidden || controller.current) return;
      try {
        const result = await readInbox('/api/admin/whatsapp/conversations?check=1',request.signal);
        if (request.signal.aborted) return;
        if (listRevision.current !== null && listRevision.current !== result.revision) load();
        listRevision.current=result.revision;
      } catch { /* A foreground refresh reports errors without discarding an active draft. */ }
    },45000);
    return () => { clearInterval(timer); request.abort(); };
  },[load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('conversationId');
    if (!id) return;
    const request = new AbortController();
    readInbox(`/api/admin/crm/followups?sourceType=conversation&sourceId=${encodeURIComponent(id)}`, request.signal)
      .then(result => { if (!request.signal.aborted) setSelected({ id, contactName: result.customerName, senderId: result.phone }); })
      .catch(err => { if (!request.signal.aborted) setError(err.message); });
    return () => request.abort();
  }, []);
  const filtered = conversations.filter(item => `${item.contactName} ${item.senderId} ${item.lastMessagePreview}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')));
  return <main className="mx-auto max-w-[1480px] px-3 py-5 sm:px-6 sm:py-7">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1c354b] text-white shadow-sm"><MessageSquare size={23}/></div><div><h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Müşteri mesajları</h1><p className="mt-1 text-xs text-slate-500">WhatsApp çalışma alanı <span className="mx-1.5 text-slate-300">/</span> HorecaLink</p></div></div>
      <div className="flex items-center gap-2"><Link href="/satissitok/admin/crm" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Müşteri Takibi</Link><Link href="/satissitok/admin" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">Yönetim paneli</Link><button type="button" onClick={() => setSettings(value => !value)} aria-expanded={settings} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600"><span className="h-2 w-2 rounded-full bg-slate-400"/>Bağlantı ayrıntıları<ChevronDown size={13}/></button></div>
    </div>
    {settings && <div className="mb-4"><ConnectionStatus readInbox={readInbox}/></div>}
    {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_45px_-22px_rgba(15,23,42,0.35)] lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside aria-label="Konuşmalar" className={`${selected ? 'hidden lg:flex' : 'flex'} min-h-[65vh] flex-col border-r border-slate-200 bg-white`}>
        <div className="border-b border-slate-100 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">Gelen kutusu <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">{conversations.length}</span></h2><button type="button" aria-label="Konuşmaları yenile" title="Konuşmaları yenile" disabled={busy} onClick={() => load()} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><RefreshCw size={15} className={busy ? 'animate-spin' : ''}/></button></div><label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 text-slate-400"><Search size={16}/><input aria-label="Yüklenen konuşmalarda ara" placeholder="İsim, numara veya mesaj ara" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-slate-700 outline-none"/></label></div>
        <ul className="max-h-[68vh] flex-1 space-y-1 overflow-y-auto p-2">{filtered.map(item => <li key={item.id}><button type="button" aria-pressed={selected?.id===item.id} onClick={() => setSelected(item)} className={`flex w-full gap-3 rounded-xl border p-3 text-left transition ${selected?.id===item.id ? 'border-orange-200 bg-orange-50' : 'border-transparent hover:bg-slate-50'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${selected?.id===item.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>{(item.contactName || item.senderId || '?').slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-800">{item.contactName || `+${item.senderId}`}</span><time className="shrink-0 text-[10px] text-slate-400">{time(item.lastIncomingAt)}</time></span><span className="mt-1 block truncate text-xs text-slate-500">{item.lastMessageDirection==='outgoing' ? 'Siz: ' : ''}{item.lastMessageType==='text' ? item.lastMessagePreview : 'Ekli mesaj'}</span><span className="mt-1 block text-[10px] text-slate-400">+{item.senderId}</span></span></button></li>)}</ul>
        {!filtered.length && <p className="p-5 text-center text-xs text-slate-400">{busy ? 'Yükleniyor…' : 'Konuşma bulunamadı.'}</p>}
        {cursor && <button type="button" disabled={busy} onClick={() => load(cursor)} className="m-3 rounded-xl border p-2 text-xs text-slate-500">Daha fazla konuşma</button>}
        <p className="border-t p-3 text-[10px] text-slate-400">Konuşmalar 30 adetlik gruplarla yüklenir. Arama yüklenen listededir.</p>
      </aside>
      {selected ? <Conversation key={selected.id} conversation={selected} cache={cache.current} onBack={() => setSelected(null)}/> : <section className="hidden min-h-[65vh] items-center justify-center bg-[#f4f6f8] p-10 text-center lg:flex"><div><MessageSquare size={44} strokeWidth={1.2} className="mx-auto mb-5 text-slate-300"/><h2 className="font-semibold text-slate-700">Bir konuşma seçin</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">Müşteri mesajlarını okuyun, Türkçesini görün ve yanıtınızı hazırlayın.</p></div></section>}
    </div>
  </main>;
}

function Conversation({conversation,cache,onBack}) {
  const initialCache = useRef(cache.get(conversation.id));
  const cached = initialCache.current;
  const [messages,setMessages] = useState(cached?.messages || []);
  const [cursor,setCursor] = useState(cached?.cursor || null);
  const [meta,setMeta] = useState(cached?.meta || {});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [translationError,setTranslationError] = useState('');
  const [translationTick,setTranslationTick] = useState(0);
  const translationChecks=useRef(new Map());
  const controller = useRef(null);
  const revision = useRef(cached?.meta?.revision || '');
  const alive = useRef(true);
  const load = useCallback(async (nextCursor=null, refresh=false) => {
    if (controller.current) return;
    const request=new AbortController(); controller.current=request; setBusy(true); setError('');
    try {
      const result=await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/messages${nextCursor ? `?cursor=${nextCursor}` : ''}`,request.signal);
      if (request.signal.aborted) return;
      const previous=cache.get(conversation.id);
      const gap=refresh && previous?.messages.length && result.messages.length===20 && !result.messages.some(row => previous.messages.some(old => old.id===row.id));
      setMessages(old => gap ? result.messages : merge(old,result.messages));
      setCursor(nextCursor || !refresh || gap || !previous?.messages.length ? result.nextCursor : previous.cursor);
      setMeta(result); revision.current=result.revision;
    } catch (err) { if (!request.signal.aborted) { setError(err.message); setMessages([]); cache.delete(conversation.id); } }
    finally { if (controller.current===request) controller.current=null; if (!request.signal.aborted) setBusy(false); }
  },[conversation.id,cache]);
  // Cache contains only the last five opened conversations for this signed-in operator.
  useEffect(() => { alive.current=true; if (!cached) load(); return () => { alive.current=false; controller.current?.abort(); controller.current=null; }; },[]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    cache.delete(conversation.id); cache.set(conversation.id,{messages,cursor,meta});
    if (cache.size>5) cache.delete(cache.keys().next().value);
  },[messages,cursor,meta,cache,conversation.id]);
  useEffect(() => {
    const request=new AbortController(); let checking=false;
    const check=async () => {
      if (document.hidden || checking || controller.current) return;
      checking=true;
      try {
        const result=await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/messages?revisionOnly=1`,request.signal);
        if (!request.signal.aborted && result.revision!==revision.current) load(null,true);
      } catch { /* Manual refresh exposes connectivity errors. */ }
      finally { checking=false; }
    };
    if (cached) check();
    const timer=setInterval(check,20000);
    return () => { clearInterval(timer); request.abort(); };
  },[conversation.id,load,cached]);
  const ids=messages.filter(message => message.type==='text' && !message.translationTr).map(message => message.id).slice(0,20).join(',');
  useEffect(() => {
    if (!ids) return;
    const request=new AbortController();
    let retry;
    const timer=setTimeout(async () => {
      const attempts=translationChecks.current.get(ids) || 0;
      if (attempts>=4) { setTranslationError('Çeviri hâlâ hazırlanıyor. Biraz sonra tekrar kontrol edebilirsiniz.'); return; }
      translationChecks.current.set(ids,attempts+1);
      try {
        const result=await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/translate`,request.signal,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'messages',ids:ids.split(',')})});
        if (request.signal.aborted) return;
        setTranslationError('');
        setMessages(old => old.map(message => { const row=result.translations.find(item => item.id===message.id); return row ? {...message,translationTr:{text:row.text,language:row.language}} : message; }));
        if (result.pending) retry=setTimeout(() => setTranslationTick(value => value+1),10000);
      } catch (err) { if (!request.signal.aborted) setTranslationError(err.message); }
    },2200);
    return () => { clearTimeout(timer); clearTimeout(retry); request.abort(); };
  },[ids,conversation.id,translationTick]);
  const latestCustomer=[...messages].filter(message => message.direction!=='outgoing' && message.type==='text').sort((a,b) => b.timestamp.localeCompare(a.timestamp))[0];
  const ordered=[...messages].sort((a,b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
  return <section className="flex min-w-0 flex-col bg-[#f4f6f8]">
    <header className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={onBack} aria-label="Konuşmalara dön" className="lg:hidden"><ArrowLeft size={19}/></button><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1c354b] text-sm font-bold text-white">{(conversation.contactName || conversation.senderId).slice(0,2).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-800">{conversation.contactName || `+${conversation.senderId}`}</h2><p className="mt-0.5 text-xs text-slate-400">+{conversation.senderId}</p></div></div><button type="button" disabled={busy} onClick={() => load(null,true)} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs text-slate-600"><RefreshCw size={13} className={busy?'animate-spin':''}/><span className="hidden sm:inline">Yenile</span></button></header>
    <div className="border-b border-slate-200 bg-white px-5 py-2 text-xs"><Link className="font-semibold text-blue-700" href={`/satissitok/admin/crm?sourceType=conversation&sourceId=${encodeURIComponent(conversation.id)}`}>Bu müşteri için takip oluştur</Link></div>
    <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-5 py-2 text-[10px] text-slate-400"><span>En yeni mesaj üstte · Geçmiş için aşağı kaydırın</span><span>Açıkken 20 saniyede değişiklik kontrolü</span></div>
    {error && <p role="alert" className="m-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    <div aria-label="Mesaj geçmişi" className="h-[48vh] min-h-64 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" onScroll={event => { const el=event.currentTarget; if (cursor && !busy && el.scrollHeight-el.scrollTop-el.clientHeight<80) load(cursor); }}>
      <ol className="space-y-4">{ordered.map((message,index) => { const outgoing=message.direction==='outgoing'; const day=new Date(message.timestamp).toLocaleDateString('tr-TR',{day:'numeric',month:'long',year:'numeric'}); return <li key={message.id}>
        {(index===0 || message.timestamp.slice(0,10)!==ordered[index-1].timestamp.slice(0,10)) && <div className="mb-5 flex justify-center"><span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] text-slate-400">{day}</span></div>}
        <div className={`flex ${outgoing?'justify-end':'justify-start'}`}><article className={`max-w-[92%] rounded-2xl p-3.5 shadow-sm sm:max-w-[78%] ${outgoing?'rounded-tr-sm bg-[#1c354b] text-white':'rounded-tl-sm border border-slate-200 bg-white text-slate-800'}`}>
          <p className={`mb-2 flex items-center gap-1.5 text-[10px] font-semibold ${outgoing?'text-blue-200':'text-slate-400'}`}>{outgoing ? message.source==='phone' ? <><Smartphone size={11}/>Siz · Telefondan</> : <><Check size={11}/>Siz · Panelden</> : 'Müşteri'}</p>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-6">{message.type==='text'?message.text:message.type==='image' && message.productCardName ? `Ürün kartı: ${message.productCardName}\n${message.text}` : `Ekli mesaj: ${message.type} (önizleme henüz desteklenmiyor)`}</p>
          {message.translationTr && message.translationTr.text.trim()!==message.text.trim() && <div className={`mt-3 border-t pt-2.5 ${outgoing?'border-white/15':'border-slate-100'}`}><p className={`mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider ${outgoing?'text-blue-200':'text-orange-600'}`}><Languages size={10}/>Türkçe çeviri</p><p className={`whitespace-pre-wrap break-words text-[12px] leading-5 ${outgoing?'text-blue-50':'text-slate-600'}`}>{message.translationTr.text}</p></div>}
          {message.sendState==='rejected' && <p className="mt-2 text-xs text-red-200">{formatSendRejection(message.sendDiagnostics)}</p>}
          <footer className={`mt-2 flex items-center justify-end gap-2 text-[9px] ${outgoing?'text-blue-200/75':'text-slate-400'}`}><span>{outgoing && message.source!=='phone' ? ({accepted:({sent:'Gönderildi',delivered:'Teslim edildi',read:'Okundu',failed:'Teslim edilemedi'})[message.deliveryStatus] || 'Kabul edildi · teslimat doğrulanmadı',rejected:'Reddedildi',sending:'Gönderiliyor',unknown:'Sonuç belirsiz'})[message.sendState] : ''}</span><time dateTime={message.timestamp}>{time(message.timestamp)}</time></footer>
        </article></div>
      </li>; })}</ol>
      {!busy && !messages.length && <p className="py-10 text-center text-xs text-slate-400">Bu konuşmada henüz mesaj yok.</p>}
      {cursor && <button type="button" disabled={busy} onClick={() => load(cursor)} className="mx-auto mt-5 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] text-slate-500"><ChevronDown size={13}/>{busy?'Yükleniyor…':'20 eski mesaj daha'}</button>}
      {!cursor && messages.length>0 && <p className="mt-6 text-center text-[10px] text-slate-400">Kayıtlı geçmişin başındasınız.</p>}
    </div>
    {translationError && <p role="status" className="border-t border-orange-100 bg-orange-50 px-5 py-2 text-[11px] text-orange-700">Türkçe çeviri: {translationError} Orijinal mesajlar kullanılabilir. <button type="button" onClick={() => { translationChecks.current.clear(); setTranslationTick(value => value+1); }} className="ml-2 underline">Çevirileri kontrol et</button></p>}
    <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6"><ReplyComposer conversation={conversation} baseIncomingAt={meta.baseIncomingAt} baseRevision={meta.baseRevision || ''} replyRecipient={meta.replyRecipient} suggestedLanguage={latestCustomer?.translationTr?.language} suggestion={latestCustomer?.text} readInbox={readInbox} onSent={() => load(null,true)}/></div>
  </section>;
}
