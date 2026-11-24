import { randomUUID } from 'node:crypto';
import { authorizeWhatsAppRequest, inboxJson } from '@/app/lib/server/whatsappInbox';
import { INBOX_COLLECTION, readBoundedBody, validInboxId } from '@/app/lib/server/whatsappInboxCore.mjs';
import { incomingRevision, millis, replyError, resolveReplyRecipient } from '@/app/lib/server/whatsappReplyCore.mjs';
import { approvedTemplate } from '@/app/lib/server/whatsappTemplates';
import { SCHEDULED_COLLECTION, validateSchedule, windowOpen } from '@/app/lib/server/whatsappScheduledCore.mjs';
import { PREFERENCES, renderTemplate } from '@/app/lib/server/whatsappFollowupCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const fail = error => inboxJson({ error: error.status ? error.message : 'Zamanlanmış gönderim işlemi tamamlanamadı.' }, error.status || 503);

async function context(request, route) {
  const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth;
  const { conversationId } = await route.params;
  if (!validInboxId(conversationId)) throw replyError('Konuşma geçersiz.');
  const ref = auth.adminDb.collection(INBOX_COLLECTION).doc(conversationId), conversation = (await ref.get()).data();
  if (!conversation) throw replyError('Konuşma bulunamadı.', 404);
  return { ...auth, ref, conversationId, conversation };
}

export async function GET(request, route) {
  try {
    const auth = await context(request, route); if (!auth.ok) return auth.response;
    const rows = await auth.adminDb.collection(SCHEDULED_COLLECTION).where('conversationId', '==', auth.conversationId).limit(50).get();
    return inboxJson({ schedules: rows.docs.map(doc => ({ id: doc.id, status: doc.data().status, kind: doc.data().kind, text: doc.data().text, recipient: doc.data().recipient, ...(doc.data().template ? { template: doc.data().template } : {}), scheduledAt: doc.data().scheduledAt?.toDate?.().toISOString?.() || doc.data().scheduledAt?.toISOString?.() || null, createdAt: doc.data().createdAt?.toDate?.().toISOString?.() || null, cancelReason: doc.data().cancelReason || '', sendState: doc.data().sendState || '', deliveryStatus: doc.data().deliveryStatus || '', sendIssue: doc.data().sendIssue || '' })).sort((a,b) => (b.scheduledAt || '').localeCompare(a.scheduledAt || '')) });
  } catch (error) { return fail(error); }
}

export async function POST(request, route) {
  try {
    const auth = await context(request, route); if (!auth.ok) return auth.response;
    let body; try { body = JSON.parse((await readBoundedBody(request, 16384)).toString('utf8')); } catch { throw replyError('İstek geçersiz.'); }
    const db = auth.adminDb;
    if (body.action === 'cancel' || body.action === 'update') {
      if (!/^[a-f0-9-]{36}$/.test(body.id || '')) throw replyError('Plan kimliği geçersiz.');
      const planRef = db.collection(SCHEDULED_COLLECTION).doc(body.id);
      const currentPlan = (await planRef.get()).data();
      let templateChange = null;
      if (body.action === 'update' && currentPlan?.kind === 'template' && body.parameters !== undefined) {
        if (!Array.isArray(body.parameters) || body.parameters.length > 8 || body.parameters.some(value => typeof value !== 'string' || value.length > 200)) throw replyError('Şablon alanları geçersiz.');
        const currentTemplate = await approvedTemplate({ templateId: currentPlan.template.id, templateName: currentPlan.template.name, templateLanguage: currentPlan.template.language, templateRevision: currentPlan.template.revision });
        templateChange = { text: renderTemplate(currentTemplate, body.parameters), template: { ...currentPlan.template, parameters: body.parameters } };
      }
      await db.runTransaction(async tx => {
        const plan = (await tx.get(planRef)).data();
        if (!plan || plan.conversationId !== auth.conversationId || plan.status !== 'scheduled') throw replyError('Bu plan artık düzenlenemiyor. Gönderim başlamış veya plan kapanmış olabilir.', 409);
        if (body.action === 'cancel') tx.update(planRef, { status: 'cancelled', cancelReason: 'Yönetici iptal etti', cancelledAt: new Date(), updatedAt: new Date() });
        else {
          if (!Number.isSafeInteger(body.scheduledAt) || body.scheduledAt < Date.now() + 60_000 || body.scheduledAt > Date.now() + 90 * 86400000) throw replyError('En az bir dakika sonraki bir Almatı saati seçin.');
          const latest = (await tx.get(auth.ref)).data();
          if (plan.kind === 'text' && !windowOpen(latest?.lastIncomingAt, body.scheduledAt)) throw replyError('Serbest metin için bu saat 24 saatlik WhatsApp penceresinin dışında. Şablonla yeni plan oluşturun.', 409);
          if (body.text !== undefined && (plan.kind !== 'text' || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 4096)) throw replyError('Mesaj metni geçersiz.');
          if (body.parameters !== undefined && (!templateChange || plan.kind !== 'template')) throw replyError('Şablon planını yenileyin.');
          if (templateChange && JSON.stringify(plan.template) !== JSON.stringify(currentPlan.template)) throw replyError('Şablon planı başka bir sekmede değişti. Yenileyip tekrar deneyin.', 409);
          tx.update(planRef, { scheduledAt: new Date(body.scheduledAt), ...(body.text !== undefined ? { text: body.text.trim() } : {}), ...(templateChange ? templateChange : {}), updatedAt: new Date() });
        }
      });
      return inboxJson({ ok: true });
    }
    const plan = validateSchedule(body), conversation = auth.conversation;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!phoneId || conversation.phoneNumberId !== phoneId || millis(conversation.lastIncomingAt) !== plan.baseIncomingAt || incomingRevision(conversation) !== plan.baseRevision) throw replyError('Konuşma veya son müşteri mesajı değişti. Görüşmeyi yenileyin.', 409);
    if (conversation.pendingSendId) throw replyError('Başka bir gönderim sürüyor. Önce sonucunu kontrol edin.', 409);
    const recipient = resolveReplyRecipient(conversation, process.env.WHATSAPP_TEST_RECIPIENT_MAP);
    if (recipient !== plan.reviewedRecipient) throw replyError('Alıcı ayarı değişti. Alıcıyı tekrar inceleyin.', 409);
    let templateData = null;
    if (plan.kind === 'text') {
      if (!windowOpen(conversation.lastIncomingAt, Date.now()) || !windowOpen(conversation.lastIncomingAt, plan.scheduledAt)) throw replyError('Seçilen gönderim saati 24 saatlik WhatsApp penceresinin dışında. Meta onaylı şablon ve önizlemesi seçin.', 409);
    } else {
      if (process.env.WHATSAPP_TEMPLATE_SEND_ENABLED !== 'true' || process.env.WHATSAPP_SEND_ENABLED !== 'true') throw replyError('Şablon gönderimi henüz etkinleştirilmedi.', 503);
      const permission = (await db.collection(PREFERENCES).doc(auth.conversationId).get()).data();
      if (permission?.status !== 'granted') throw replyError('Müşterinin şablon mesajı izni kayıtlı değil veya geri çekilmiş.', 409);
      templateData = await approvedTemplate(plan);
      const preview = renderTemplate(templateData, plan.parameters);
      if (preview !== plan.text) throw replyError('Şablon önizlemesi değişti. Yenileyip tekrar onaylayın.', 409);
    }
    const outgoing = await auth.ref.collection('messages').where('direction', '==', 'outgoing').orderBy('timestamp', 'desc').limit(1).get();
    const lastOutgoingAt = outgoing.docs[0]?.data()?.timestamp || 0;
    const permission = templateData ? (await db.collection(PREFERENCES).doc(auth.conversationId).get()).data() : null;
    const id = randomUUID(), planRef = db.collection(SCHEDULED_COLLECTION).doc(id), now = Date.now();
    await db.runTransaction(async tx => {
      const latest = (await tx.get(auth.ref)).data();
      const existing = await tx.get(planRef);
      if (!latest || existing.exists || millis(latest.lastIncomingAt) !== plan.baseIncomingAt || incomingRevision(latest) !== plan.baseRevision || latest.pendingSendId || lastOutgoingAt > now || millis(latest.lastOutgoingAt) > lastOutgoingAt) throw replyError('Konuşma değişti. Yenileyip planı yeniden inceleyin.', 409);
      tx.create(planRef, { id, conversationId: auth.conversationId, senderId: latest.senderId, phoneNumberId, recipient, kind: plan.kind, text: plan.text,
        ...(templateData ? { template: { id: templateData.id, name: templateData.name, language: templateData.language, category: templateData.category, revision: templateData.revision, parameters: plan.parameters }, permissionRevision: permission?.revision || '' } : {}),
        status: 'scheduled', scheduledAt: new Date(plan.scheduledAt), baseIncomingAt: plan.baseIncomingAt, baseRevision: plan.baseRevision, lastOutgoingAt,
        createdAt: new Date(now), createdBy: auth.uid, updatedAt: new Date(now) });
    });
    return inboxJson({ ok: true, id });
  } catch (error) { return fail(error); }
}
