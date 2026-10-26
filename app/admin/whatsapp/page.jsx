'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { auth } from '@/firebase/index';
import { formatSendRejection } from '@/app/lib/whatsappSendFeedback.mjs';
import ReplyComposer from './ReplyComposer';
import ConnectionStatus from './ConnectionStatus';

const formatDate = value => value ? new Date(value).toLocaleString('tr-TR') : '';
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

function WhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  const load = useCallback(async (nextCursor = null) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    try {
      const result = await readInbox(`/api/admin/whatsapp/conversations${nextCursor ? `?cursor=${nextCursor}` : ''}`, request.signal);
      if (request.signal.aborted) return;
      setConversations(previous => nextCursor ? [...new Map([...previous, ...result.conversations].map(item => [item.id, item])).values()] : result.conversations);
      setCursor(result.nextCursor);
    } catch (err) {
      if (!request.signal.aborted) { setError(err.message); setConversations([]); setSelected(null); setCursor(null); }
    } finally { if (!request.signal.aborted) setBusy(false); }
  }, []);
  useEffect(() => { load(); return () => controller.current?.abort(); }, [load]);
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <Link href="/satissitok/admin" className="text-sm text-blue-700 underline">Yönetim paneline dön</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold">WhatsApp mesajları</h1><p className="mt-1 text-sm text-slate-600">Mesajları okuyun, yanıt hazırlayın ve inceleyerek gönderin.</p></div>
        <button type="button" onClick={() => load()} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Yükleniyor...' : 'Yenile'}</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <ConnectionStatus readInbox={readInbox} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <section aria-label="Konuşmalar" className="rounded-xl border bg-white p-3">
          {!conversations.length && !busy && !error && <p className="p-3 text-sm text-slate-600">Henüz gelen mesaj yok.</p>}
          <ul className="space-y-2">{conversations.map(item => (
            <li key={item.id}><button type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelected(item)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === item.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <span className="block font-semibold">{item.contactName || `+${item.senderId}`}</span>
              {item.contactName && <span className="block text-xs text-slate-500">+{item.senderId}</span>}
              <span className="mt-2 block truncate text-sm text-slate-700">{item.lastMessageType === 'text' ? item.lastMessagePreview : `Diğer mesaj türü: ${item.lastMessageType}`}</span>
              <span className="mt-1 block text-xs text-slate-500">{formatDate(item.lastIncomingAt)}</span>
            </button></li>
          ))}</ul>
          {cursor && <button type="button" disabled={busy} onClick={() => load(cursor)} className="mt-3 w-full rounded-lg border p-2 disabled:opacity-50">Daha fazla konuşma</button>}
        </section>
        {selected ? <Conversation key={selected.id} conversation={selected} /> : <section className="rounded-xl border bg-white p-6 text-slate-600">Mesajları görmek için bir konuşma seçin.</section>}
      </div>
    </main>
  );
}

function Conversation({ conversation }) {
  const [baseIncomingAt, setBaseIncomingAt] = useState(null);
  const [baseRevision, setBaseRevision] = useState('');
  const [replyRecipient, setReplyRecipient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  const load = useCallback(async (nextCursor = null) => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError('');
    try {
      const result = await readInbox(`/api/admin/whatsapp/conversations/${conversation.id}/messages${nextCursor ? `?cursor=${nextCursor}` : ''}`, request.signal);
      if (request.signal.aborted) return;
      setMessages(previous => nextCursor ? [...new Map([...previous, ...result.messages].map(item => [item.id, item])).values()] : result.messages);
      setCursor(result.nextCursor);
      if (!nextCursor) { setBaseIncomingAt(result.baseIncomingAt); setBaseRevision(result.baseRevision); setReplyRecipient(result.replyRecipient); }
    } catch (err) { if (!request.signal.aborted) { setError(err.message); setMessages([]); setCursor(null); setBaseIncomingAt(null); setReplyRecipient(null); } }
    finally { if (!request.signal.aborted) setBusy(false); }
  }, [conversation.id]);
  useEffect(() => { load(); return () => controller.current?.abort(); }, [load]);
  return <section aria-label="Gelen mesajlar" className="min-w-0 rounded-xl border bg-white p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{conversation.contactName || `+${conversation.senderId}`}</h2><button type="button" disabled={busy} onClick={() => load()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{busy ? 'Yükleniyor...' : 'Mesajları yenile'}</button></div>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    {!busy && !error && !messages.length && <p className="text-sm text-slate-600">Bu konuşmada saklanan mesaj yok.</p>}
    {cursor && <button type="button" disabled={busy} onClick={() => load(cursor)} className="mb-4 rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Önceki mesajlar</button>}
    <ol className="space-y-3">{[...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)).map(message => <li key={message.id} className={`rounded-lg p-3 ${message.direction === 'outgoing' ? 'bg-blue-50' : 'bg-slate-50'}`}>
      {message.direction === 'outgoing' && <p className="mb-1 text-xs text-slate-600">Yanıt · {({accepted: 'Gönderim kabul edildi (teslimat doğrulanmadı)', rejected: 'Reddedildi', sending: 'Gönderiliyor', unknown: 'Sonuç belirsiz'})[message.sendState] || 'Sonuç belirsiz'}</p>}
      {message.sendState === 'rejected' && <p className="mb-2 text-xs text-red-700">{formatSendRejection(message.sendDiagnostics)}</p>}
      <p className="whitespace-pre-wrap break-words text-sm">{message.type === 'text' ? message.text : `Bu mesaj türü henüz görüntülenemiyor: ${message.type}`}</p>
      <time dateTime={message.timestamp} className="mt-2 block text-xs text-slate-500">{formatDate(message.timestamp)}</time>
    </li>)}</ol>
    <ReplyComposer conversation={conversation} baseIncomingAt={baseIncomingAt} baseRevision={baseRevision} replyRecipient={replyRecipient} onSent={() => load()} />
  </section>;
}
