import { randomUUID } from 'node:crypto';
import { authorizeWhatsAppRequest, inboxJson, inboxIso } from '@/app/lib/server/whatsappInbox';
import { INBOX_COLLECTION, validInboxId, readBoundedBody } from '@/app/lib/server/whatsappInboxCore.mjs';
import { digest, millis, replyError, resolveReplyRecipient, safeSendDiagnostics } from '@/app/lib/server/whatsappReplyCore.mjs';
import { PREFERENCES, TASKS, followupId, checkTask, checkPermission, checkCooldown, assertTemplateConversation, consentBody, templateRequest, renderTemplate } from '@/app/lib/server/whatsappFollowupCore.mjs';
import { approvedTemplate } from '@/app/lib/server/whatsappTemplates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function authorize(request, context) {
  const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth;
  const { conversationId } = await context.params;
  if (!validInboxId(conversationId)) throw replyError('Görüşme geçersiz.');
  const ref = auth.adminDb.collection(INBOX_COLLECTION).doc(conversationId), snap = await ref.get();
  if (!snap.exists) throw replyError('Görüşme bulunamadı.', 404);
  return { ...auth, ref, conversationId, conversation: snap.data() };
}
const fail = error => inboxJson({ error: error.status ? error.message : 'Takip işlemi tamamlanamadı. Görüşmeyi yenileyin.' }, error.status || 503);
export async function GET(request, context) {
  try {
    const auth = await authorize(request, context); if (!auth.ok) return auth.response;
    const id = followupId(new URL(request.url).searchParams.get('taskId'));
    const task = (await auth.adminDb.collection(TASKS).doc(id).get()).data(); checkTask(task, auth.conversationId);
    const pref = (await auth.adminDb.collection(PREFERENCES).doc(auth.conversationId).get()).data();
    const last = millis(auth.conversation.lastIncomingAt);
    return inboxJson({ task: { id, revision: task.revision, title: task.title, kind: task.kind, dueAt: inboxIso(task.dueAt), lastFollowupSentAt: inboxIso(task.lastFollowupSentAt) },
      permission: { status: pref?.status || 'unknown', revision: pref?.revision || '', recordedAt: inboxIso(pref?.recordedAt) },
      customerRepliedSinceTask: last > millis(task.createdAt), windowOpen: !!last && Date.now() >= last && Date.now() - last < 86400000,
      templateSendEnabled: process.env.WHATSAPP_TEMPLATE_SEND_ENABLED === 'true' && process.env.WHATSAPP_SEND_ENABLED === 'true' });
  } catch (error) { return fail(error); }
}
export async function POST(request, context) {
  try {
    const auth = await authorize(request, context); if (!auth.ok) return auth.response;
    let body;
    try { body = JSON.parse((await readBoundedBody(request, 16384)).toString('utf8')); } catch { throw replyError('İstek geçersiz veya çok büyük.'); }
    if (body?.action === 'consent') {
      const change = consentBody(body), ref = auth.adminDb.collection(PREFERENCES).doc(auth.conversationId), now = new Date();
      await auth.adminDb.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if ((current?.revision || '') !== change.revision) throw replyError('İletişim izni değişti. Bilgiyi yenileyin.', 409);
        const record = { status: change.status, source: change.source, scope: 'followup', revision: randomUUID(), recordedAt: now, recordedBy: auth.uid };
        tx.set(ref, record); tx.create(ref.collection('events').doc(), { ...record, previousStatus: current?.status || 'unknown' });
      });
      return inboxJson({ ok: true });
    }
    return await sendTemplate(auth, templateRequest(body));
  } catch (error) { return fail(error); }
}
async function sendTemplate(auth, body) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID, version = process.env.WHATSAPP_GRAPH_API_VERSION;
  if (process.env.WHATSAPP_TEMPLATE_SEND_ENABLED !== 'true' || process.env.WHATSAPP_SEND_ENABLED !== 'true' || !process.env.WHATSAPP_ACCESS_TOKEN || !/^\d{1,40}$/.test(phoneId || '') || !/^v\d+\.\d+$/.test(version || '')) throw replyError('Şablon gönderimi henüz etkinleştirilmedi.', 503);
  const id = digest(`outgoing:${body.requestId}`), messageRef = auth.ref.collection('messages').doc(id);
  const fingerprint = digest(JSON.stringify({ task: body.followupId, taskRevision: body.followupRevision, permission: body.permissionRevision,
    template: body.templateId, revision: body.templateRevision, parameters: body.parameters, text: body.reviewedText, recipient: body.reviewedRecipient, base: body.baseRevision }));
  const resultOf = data => {
    if (data.approvedBy !== auth.uid || data.sendFingerprint !== fingerprint) throw replyError('Gönderim kimliği farklı bir içeriğe ait.', 409);
    return { ok: true, state: data.sendState, diagnostics: data.sendDiagnostics || null, issue: data.sendIssue || '' };
  };
  const prior = await messageRef.get();
  if (prior.exists) return inboxJson(resultOf(prior.data()));
  const template = await approvedTemplate(body), text = renderTemplate(template, body.parameters);
  if (text !== body.reviewedText) throw replyError('Şablon önizlemesi değişti. Yeniden inceleyin.', 409);
  const taskRef = auth.adminDb.collection(TASKS).doc(body.followupId), permissionRef = auth.adminDb.collection(PREFERENCES).doc(auth.conversationId);
  const claim = await auth.adminDb.runTransaction(async tx => {
    const conversation = (await tx.get(auth.ref)).data(), existing = await tx.get(messageRef);
    if (existing.exists) return { existing: resultOf(existing.data()) };
    const task = (await tx.get(taskRef)).data(), preference = (await tx.get(permissionRef)).data();
    assertTemplateConversation(conversation, body, phoneId); checkTask(task, auth.conversationId, body.followupRevision); checkCooldown(task); checkPermission(preference, body.permissionRevision);
    const recipient = resolveReplyRecipient(conversation, process.env.WHATSAPP_TEST_RECIPIENT_MAP);
    if (recipient !== body.reviewedRecipient) throw replyError('Alıcı ayarı değişti. Alıcıyı yeniden kontrol edin.', 409);
    const now = Date.now();
    tx.create(messageRef, { type: 'text', text, direction: 'outgoing', source: 'panel', sendState: 'sending', sendFingerprint: fingerprint,
      timestamp: now, receivedAt: new Date(now), approvedAt: new Date(now), approvedBy: auth.uid, senderId: conversation.senderId, apiRecipient: recipient,
      phoneNumberId: phoneId, followupId: body.followupId, followupRevision: body.followupRevision, permissionRevision: body.permissionRevision,
      template: { id: template.id, name: template.name, language: template.language, category: template.category, revision: template.revision, parameters: body.parameters }, expiresAt: new Date(now + 90 * 86400000) });
    tx.update(auth.ref, { pendingSendId: id });
    return { recipient, canonicalRecipient: conversation.senderId };
  });
  if (claim.existing) return inboxJson(claim.existing);
  let state = 'unknown', diagnostics = null, metaMessageId = '', issue = '', attempted = false;
  try {
    const latest = (await auth.ref.get()).data(), task = (await taskRef.get()).data(), preference = (await permissionRef.get()).data();
    if (latest?.pendingSendId !== id) throw new Error('Claim changed');
    assertTemplateConversation({ ...latest, pendingSendId: null }, body, phoneId); checkTask(task, auth.conversationId, body.followupRevision); checkPermission(preference, body.permissionRevision);
    attempted = true;
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: claim.recipient, type: 'template', template: { name: template.name, language: { code: template.language },
        ...(body.parameters.length ? { components: [{ type: 'body', parameters: body.parameters.map(value => ({ type: 'text', text: value })) }] } : {}) } }) });
    const data = await response.json();
    if (response.ok && typeof data.messages?.[0]?.id === 'string' && (!data.contacts || (Array.isArray(data.contacts) && data.contacts.length === 1 && data.contacts[0].wa_id === claim.canonicalRecipient))) { state = 'accepted'; metaMessageId = data.messages[0].id; }
    else if (response.status >= 400 && response.status < 500 && data.error) { state = 'rejected'; diagnostics = safeSendDiagnostics(response.status, data.error); }
  } catch { if (!attempted) { state = 'rejected'; issue = 'Takip veya iletişim izni değişti. Mesaj gönderilmedi; bilgileri yenileyin.'; } }
  const delivery = metaMessageId ? await import('@/app/lib/server/whatsappDeliveryCore.mjs') : null;
  const receiptRef = delivery ? auth.adminDb.collection(delivery.RECEIPTS).doc(delivery.receiptId(phoneId, metaMessageId)) : null;
  await auth.adminDb.runTransaction(async tx => {
    const conversation = (await tx.get(auth.ref)).data(), task = (await tx.get(taskRef)).data();
    const receipt = receiptRef ? (await tx.get(receiptRef)).data() : null;
    tx.update(messageRef, { sendState: state, metaMessageId, ...(delivery ? delivery.deliveryPatch(receipt, claim.canonicalRecipient) : {}), sendDiagnostics: diagnostics, sendIssue: issue });
    if (state === 'accepted') {
      const now = new Date();
      tx.update(auth.ref, { activityRevision: digest(`${id}:${state}`), updatedAt: now, lastMessageAt: now, lastMessageDirection: 'outgoing', lastMessageType: 'text', lastMessagePreview: text.slice(0, 240) });
      if (task) {
        tx.update(taskRef, { lastFollowupSentAt: now, lastFollowupBaseRevision: body.baseRevision, lastFollowupMessageId: id, revision: randomUUID(), updatedAt: now, updatedBy: auth.uid });
        tx.set(taskRef.collection('events').doc(id), { action: 'template_accepted', at: now, actor: auth.uid, messageId: id, deliveryConfirmed: false });
      }
    }
    if (receiptRef) tx.set(receiptRef, { conversationId: auth.ref.id, messageId: id, recipientId: claim.canonicalRecipient, phoneNumberId: phoneId, metaMessageId,
      expiresAt: receipt?.expiresAt || new Date(Date.now() + 90 * 86400000) }, { merge: true });
    if (conversation?.pendingSendId === id && state !== 'unknown') tx.update(auth.ref, { pendingSendId: null });
  });
  return inboxJson({ ok: true, state, diagnostics, issue });
}
