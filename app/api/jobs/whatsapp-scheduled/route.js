import { getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { digest } from '@/app/lib/server/whatsappReplyCore.mjs';
import { SCHEDULED_COLLECTION, preflightSchedule } from '@/app/lib/server/whatsappScheduledCore.mjs';
import { PREFERENCES, renderTemplate } from '@/app/lib/server/whatsappFollowupCore.mjs';
import { approvedTemplate } from '@/app/lib/server/whatsappTemplates';
import { secretMatches } from '@/app/lib/server/whatsappInboxCore.mjs';
import { RECEIPTS, deliveryPatch, receiptId } from '@/app/lib/server/whatsappDeliveryCore.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function GET() {
  return json({ error: 'Method not allowed' }, 405);
}

export async function POST(request) {
  if (!secretMatches(request.headers.get('x-whatsapp-scheduler-secret'), process.env.WHATSAPP_SCHEDULER_SECRET)) return json({ error: 'Unauthorized' }, 401);
  const db = getAdminServices().adminDb, now = Date.now();
  let due;
  try {
    const stale = await db.collection(SCHEDULED_COLLECTION).where('status', 'in', ['sending', 'submitting']).where('updatedAt', '<=', new Date(now - 5 * 60_000)).limit(25).get();
    for (const row of stale.docs) await db.runTransaction(async tx => {
      const current = (await tx.get(row.ref)).data();
      if (current && ['sending', 'submitting'].includes(current.status) && millisValue(current.updatedAt) <= now - 5 * 60_000) tx.update(row.ref, { status: 'unknown', sendState: 'unknown', sendIssue: 'Gönderim doğrulanamadı', updatedAt: new Date(now) });
    });
    due = await db.collection(SCHEDULED_COLLECTION).where('status', '==', 'scheduled').where('scheduledAt', '<=', new Date(now)).orderBy('scheduledAt').limit(25).get();
  }
  catch { return json({ error: 'Scheduled queue unavailable' }, 503); }
  const completed = await Promise.allSettled(due.docs.map(row => dispatch(db, row.ref, row.data(), now)));
  const results = completed.map((result, index) => result.status === 'fulfilled' ? result.value : { id: due.docs[index].id, state: 'unknown' });
  return json({ processed: results.length, results });
}

const millisValue = value => value?.toMillis?.() ?? value?.getTime?.() ?? 0;

const reasonText = reason => ({ customer_message: 'Müşteri mesaj gönderdi', operator_message: 'Siz mesaj gönderdiniz', manual_send_in_progress: 'Siz mesaj gönderdiniz', window_closed: '24 saatlik WhatsApp yanıt penceresi kapandı', permission_invalid: 'Müşterinin şablon gönderim izni geçersiz veya geri çekilmiş', conversation_changed: 'Konuşma veya alıcı ayarı değişti', plan_changed: 'Plan durumu değişti' })[reason] || 'Gönderim için gerekli koşullar artık geçerli değil';

async function dispatch(db, planRef, initial, now) {
  const conversationRef = db.collection('whatsapp_conversations').doc(initial.conversationId);
  const preferenceRef = db.collection(PREFERENCES).doc(initial.conversationId);
  const claim = await db.runTransaction(async tx => {
    const [currentSnap, conversationSnap, prefSnap] = await Promise.all([tx.get(planRef), tx.get(conversationRef), tx.get(preferenceRef)]);
    const plan = currentSnap.data(), conversation = conversationSnap.data(), preference = prefSnap.data();
    if (!plan || plan.status !== 'scheduled') return { skip: true };
    const decision = preflightSchedule({ ...plan, id: planRef.id, permissionStatus: preference?.status, currentPermissionRevision: preference?.revision }, conversation, now);
    if (!decision.ok) {
      if (decision.reason !== 'not_due') tx.update(planRef, { status: 'cancelled', cancelReason: reasonText(decision.reason), cancelledAt: new Date(now), updatedAt: new Date(now) });
      return { skip: true, reason: decision.reason };
    }
    const claimId = `scheduled:${planRef.id}`;
    tx.update(planRef, { status: 'sending', claimId, sendStartedAt: new Date(now), updatedAt: new Date(now) });
    tx.update(conversationRef, { pendingSendId: claimId });
    return { plan, conversation, preference, claimId };
  });
  if (claim.skip) return { id: planRef.id, state: claim.reason || 'skipped' };
  const { plan, claimId } = claim;
  const text = plan.text;
  let state = 'unknown', metaMessageId = '', diagnostic = null, issue = '', attempted = false, template = null;
  try {
    if (plan.kind === 'template') {
      if (process.env.WHATSAPP_TEMPLATE_SEND_ENABLED !== 'true' || process.env.WHATSAPP_SEND_ENABLED !== 'true') throw new Error('TEMPLATE_DISABLED');
      template = await approvedTemplate({ templateId: plan.template.id, templateName: plan.template.name, templateLanguage: plan.template.language, templateRevision: plan.template.revision });
      if (renderTemplate(template, plan.template.parameters) !== text) throw new Error('TEMPLATE_CHANGED');
    }
    const sent = await db.runTransaction(async tx => {
      const [latestPlanSnap, latestConversationSnap, prefSnap] = await Promise.all([tx.get(planRef), tx.get(conversationRef), tx.get(preferenceRef)]);
      const latestPlan = latestPlanSnap.data(), latest = latestConversationSnap.data(), pref = prefSnap.data();
      if (!latestPlan || latestPlan.status !== 'sending' || latestPlan.claimId !== claimId || latest?.pendingSendId !== claimId) return false;
      const check = preflightSchedule({ ...latestPlan, id: planRef.id, status: 'scheduled', permissionStatus: pref?.status, currentPermissionRevision: pref?.revision }, { ...latest, pendingSendId: null }, Date.now());
      if (!check.ok || (plan.kind === 'template' && plan.permissionRevision !== pref?.revision)) {
        tx.update(planRef, { status: 'cancelled', cancelReason: reasonText(check.ok ? 'permission_invalid' : check.reason), cancelledAt: new Date(), updatedAt: new Date() });
        tx.update(conversationRef, { pendingSendId: null });
        return false;
      }
      tx.update(planRef, { status: 'submitting', submitStartedAt: new Date(), updatedAt: new Date() });
      return true;
    });
    if (!sent) return { id: planRef.id, state: 'cancelled' };
    attempted = true;
    const version = process.env.WHATSAPP_GRAPH_API_VERSION, phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(plan.kind === 'template'
        ? { messaging_product: 'whatsapp', to: plan.recipient, type: 'template', template: { name: template.name, language: { code: template.language }, ...(plan.template.parameters.length ? { components: [{ type: 'body', parameters: plan.template.parameters.map(value => ({ type: 'text', text: value })) }] } : {}) } }
        : { messaging_product: 'whatsapp', to: plan.recipient, type: 'text', text: { body: text, preview_url: false } }) });
    const data = await response.json();
    if (response.ok && typeof data.messages?.[0]?.id === 'string' && (!data.contacts || (data.contacts.length === 1 && data.contacts[0].wa_id === plan.senderId))) { state = 'accepted'; metaMessageId = data.messages[0].id; }
    else if (response.status >= 400 && response.status < 500 && data.error) { state = 'rejected'; diagnostic = { httpStatus: response.status, code: Number.isSafeInteger(data.error.code) ? data.error.code : null, subcode: Number.isSafeInteger(data.error.error_subcode) ? data.error.error_subcode : null }; }
  } catch { if (!attempted) { state = 'rejected'; issue = plan.kind === 'template' ? 'Şablon veya müşteri izni geçersiz. Mesaj gönderilmedi.' : '24 saatlik yanıt penceresi kapandı. Mesaj gönderilmedi.'; } }
  const messageId = digest(`scheduled:${planRef.id}`), messageRef = conversationRef.collection('messages').doc(messageId);
  const receiptRef = metaMessageId ? db.collection(RECEIPTS).doc(receiptId(plan.phoneNumberId, metaMessageId)) : null;
  await db.runTransaction(async tx => {
    const [latestPlanSnap, latestConversationSnap, priorMessage, receipt] = await Promise.all([
      tx.get(planRef), tx.get(conversationRef), tx.get(messageRef), receiptRef ? tx.get(receiptRef) : Promise.resolve({ data: () => null }),
    ]);
    const latestPlan = latestPlanSnap.data(), latestConversation = latestConversationSnap.data();
    if (latestPlan?.status !== 'submitting' || latestPlan.claimId !== claimId) return;
    const receivedReceipt = receipt.data();
    if (!priorMessage.exists) tx.create(messageRef, { direction: 'outgoing', source: 'scheduled', type: 'text', text, timestamp: now, receivedAt: new Date(now), senderId: plan.senderId, phoneNumberId: plan.phoneNumberId, apiRecipient: plan.recipient, sendState: state, metaMessageId, ...(receiptRef ? deliveryPatch(receivedReceipt, plan.senderId) : {}), sendDiagnostics: diagnostic, sendIssue: issue, scheduledId: planRef.id, ...(plan.template ? { template: plan.template } : {}), expiresAt: new Date(now + 90 * 86400000) });
    const deliveryStatus = receivedReceipt?.receiptRecipientId === plan.senderId ? receivedReceipt.deliveryStatus : '';
    tx.update(planRef, { status: state === 'accepted' ? 'accepted' : state === 'rejected' ? 'rejected' : 'unknown', sendState: state, metaMessageId, ...(deliveryStatus ? { deliveryStatus, deliveryAt: receivedReceipt.deliveryAt } : {}), sendDiagnostics: diagnostic, sendIssue: issue, submittedAt: new Date(), updatedAt: new Date() });
    if (receiptRef) tx.set(receiptRef, { conversationId: plan.conversationId, messageId, recipientId: plan.senderId, phoneNumberId: plan.phoneNumberId, metaMessageId, expiresAt: receivedReceipt?.expiresAt || new Date(Date.now() + 90 * 86400000) }, { merge: true });
    if (latestConversation?.pendingSendId === claimId && state !== 'unknown') tx.update(conversationRef, { pendingSendId: null, ...(state === 'accepted' ? { activityRevision: digest(`${messageId}:accepted`), lastOutgoingAt: new Date(now), lastMessageAt: new Date(now), updatedAt: new Date(now), lastMessageDirection: 'outgoing', lastMessageType: 'text', lastMessagePreview: text.slice(0, 240) } : {}) });
  });
  return { id: planRef.id, state };
}
