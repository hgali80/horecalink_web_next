import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';
import { INBOX_COLLECTION, readBoundedBody, validInboxId } from '@/app/lib/server/whatsappInboxCore.mjs';
import { languageQuota, translateTexts } from '@/app/lib/server/whatsappLanguage.mjs';
import { replyError } from '@/app/lib/server/whatsappReplyCore.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request, context) {
  try {
    const auth = await authorizeWhatsAppRequest(request);
    if (!auth.ok) return auth.response;
    const { conversationId } = await context.params;
    if (!validInboxId(conversationId)) throw replyError('Konuşma geçersiz.');
    let body;
    try { body = JSON.parse((await readBoundedBody(request, 20000)).toString('utf8')); }
    catch { throw replyError('Çeviri isteği geçersiz.'); }
    const conversation = auth.adminDb.collection(INBOX_COLLECTION).doc(conversationId);
    if (!(await conversation.get()).exists) throw replyError('Konuşma bulunamadı.',404);
    if (body.action === 'compose') {
      if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096 || !['ru','kk','tr','en'].includes(body.target)) throw replyError('Metni ve hedef dili kontrol edin.');
      await languageQuota(auth.adminDb, auth.uid);
      const rows = await translateTexts([{ id:'compose',text:body.text }], body.target);
      if (rows[0].text.length > 4096) throw replyError('Çeviri WhatsApp metin sınırını aşıyor. Kaynak metni kısaltın.');
      return inboxJson({ text: rows[0].text, language: rows[0].language });
    }
    if (body.action !== 'messages' || !Array.isArray(body.ids) || !body.ids.length || body.ids.length > 20 || body.ids.some(id => !validInboxId(id))) throw replyError('Mesaj seçimi geçersiz.');
    const refs = [...new Set(body.ids)].map(id => conversation.collection('messages').doc(id));
    const now = Date.now();
    const cached = [];
    let claimed = [], pending = 0;
    // Per-message lease prevents repeated paid calls across tabs/operators.
    await auth.adminDb.runTransaction(async tx => {
      const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
      const next = [];
      let length = 0;
      cached.length = 0; pending = 0;
      snapshots.forEach((snapshot,index) => {
        const data = snapshot.data();
        if (!snapshot.exists || data.type !== 'text' || !data.text?.trim()) return;
        if (data.translationTr) { cached.push({ id:refs[index].id, ...data.translationTr }); return; }
        if ((data.translationPendingUntil || 0) > now) { pending++; return; }
        if ((data.translationRetryAfter || 0) > now) return;
        if (length + data.text.length > 24000) { pending++; return; }
        length += data.text.length;
        next.push({ ref:refs[index], id:refs[index].id, text:data.text });
      });
      next.forEach(item => tx.update(item.ref, { translationPendingUntil: now + 60000 }));
      claimed = next;
    });
    if (claimed.length) {
      try {
        await languageQuota(auth.adminDb, auth.uid);
        const rows = await translateTexts(claimed.map(({id,text}) => ({id,text})), 'tr');
        await Promise.all(rows.map(row => claimed.find(item => item.id === row.id).ref.update({ translationTr:{text:row.text,language:row.language}, translationPendingUntil:0 })));
        cached.push(...rows);
      } catch (error) {
        await Promise.all(claimed.map(item => item.ref.update({ translationPendingUntil:0, translationRetryAfter:Date.now() + 300000 })));
        throw error;
      }
    }
    return inboxJson({ translations:cached, pending });
  } catch (error) { return inboxJson({ error:error.status ? error.message : 'Çeviri hazırlanamadı.' },error.status || 503); }
}
