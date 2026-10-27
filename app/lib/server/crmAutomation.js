import 'server-only';
import { randomUUID } from 'node:crypto';
import { automationDecision, notificationId, notificationCurrent, milliseconds, hash, NOTIFICATIONS, SUBSCRIPTIONS, STATE } from './crmAutomationCore.mjs';

const TASKS = 'crm_followups';
export async function processTask(db, taskId, now = Date.now()) {
  const ref = db.collection(TASKS).doc(taskId);
  return db.runTransaction(async tx => {
    const task = (await tx.get(ref)).data(); if (!task || task.status !== 'open') return 'skipped';
    const conversation = task.conversationId ? (await tx.get(db.collection('whatsapp_conversations').doc(task.conversationId))).data() : null;
    const preference = task.conversationId ? (await tx.get(db.collection('crm_contact_preferences').doc(task.conversationId))).data() : null;
    const offer = task.offerId ? (await tx.get(db.collection('commercial_offers').doc(task.offerId))).data() : null;
    const sale = offer?.salesDocumentId ? (await tx.get(db.collection('erp_sales').doc(offer.salesDocumentId))).data() : null;
    const decision = automationDecision(task, { conversation, preference, offer, sale, now });
    if (decision.action === 'skip') return 'skipped';
    const uid = task.assignedTo || task.createdBy;
    const owner = uid ? (await tx.get(db.collection('users').doc(uid))).data() : null;
    const id = notificationId(taskId, task), notificationRef = db.collection(NOTIFICATIONS).doc(id);
    const existing = await tx.get(notificationRef);
    if (decision.action !== 'notify') {
      tx.update(ref, { status: decision.action === 'complete' ? 'completed' : 'paused', automationReason: decision.reason,
        closedAt: decision.action === 'complete' ? new Date(now) : null, revision: randomUUID(), updatedAt: new Date(now), updatedBy: 'crm_automation' });
      tx.set(ref.collection('events').doc(`automation_${id}`), { action: decision.action, reason: decision.reason, at: new Date(now), actor: 'crm_automation' });
    }
    if (existing.exists && decision.action !== 'notify') {
      const old = existing.data();
      tx.update(notificationRef, { kind: decision.action === 'pause' ? 'review' : 'resolved', reason: decision.reason, status: 'unread', pushState: decision.action === 'complete' ? 'skipped' : old.pushState });
    }
    if (!existing.exists && owner?.isActive === true && ['admin', 'super_admin'].includes(owner.role)) {
      tx.create(notificationRef, { uid, taskId, conversationId: task.conversationId || '', dueAt: task.dueAt, kind: decision.action === 'pause' ? 'review' : decision.action === 'complete' ? 'resolved' : 'due',
        reason: decision.reason, status: 'unread', pushState: decision.action === 'complete' ? 'skipped' : 'pending', createdAt: new Date(now), expiresAt: new Date(now + 90 * 86400000) });
    }
    return decision.action === 'notify' ? existing.exists ? 'deduplicated' : owner?.isActive === true && ['admin', 'super_admin'].includes(owner.role) ? 'notified' : 'skipped' : decision.action === 'pause' ? 'paused' : 'completed';
  });
}

export async function dispatchPush(db, notificationRef, sendPush, now = Date.now(), timeoutMs = 7000) {
  const claim = await db.runTransaction(async tx => {
    const notification = (await tx.get(notificationRef)).data();
    if (!notification || notification.pushState !== 'pending') return null;
    const task = (await tx.get(db.collection(TASKS).doc(notification.taskId))).data();
    const owner = (await tx.get(db.collection('users').doc(notification.uid))).data();
    if (!notificationCurrent({ id: notificationRef.id, ...notification }, task) || notification.status !== 'unread' || milliseconds(notification.expiresAt) <= now || owner?.isActive !== true || !['admin', 'super_admin'].includes(owner.role)) {
      tx.update(notificationRef, { pushState: 'skipped' }); return null;
    }
    tx.update(notificationRef, { pushState: 'sending', pushClaimedAt: new Date(now) });
    return notification;
  });
  if (!claim) return 'skipped';
  try {
    const snapshot = await db.collection(SUBSCRIPTIONS).where('uid', '==', claim.uid).limit(10).get();
    const subscriptions = snapshot.docs.filter(doc => milliseconds(doc.data().expiresAt) > now);
    if (!subscriptions.length) { await notificationRef.update({ pushState: 'no_subscription' }); return 'no_subscription'; }
    let timer;
    const sending = sendPush({ tokens: subscriptions.map(doc => doc.data().token), data: { type: 'crm_due', notificationId: notificationRef.id, ownerHash: hash(claim.uid) }, webpush: { headers: { TTL: '3600', Urgency: 'normal' } } });
    let result;
    try { result = await Promise.race([sending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PUSH_TIMEOUT')), timeoutMs); })]); }
    finally { clearTimeout(timer); }
    await notificationRef.update({ pushState: result.successCount ? 'accepted' : 'failed', pushSuccessCount: result.successCount, pushFailureCount: result.failureCount, pushProcessedAt: new Date() });
    for (let i = 0; i < result.responses.length; i++) if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.responses[i].error?.code)) await subscriptions[i].ref.delete();
    return result.successCount ? 'accepted' : 'failed';
  } catch { await notificationRef.update({ pushState: 'unknown', pushProcessedAt: new Date() }); return 'unknown'; }
}

export async function runAutomation(db, { sendPush, now = Date.now(), deadline = now + 45000, scanTasks = true } = {}) {
  const stateRef = db.collection(STATE).doc('followups'), leaseId = randomUUID();
  const cursor = await db.runTransaction(async tx => {
    const state = (await tx.get(stateRef)).data() || {};
    if (milliseconds(state.leaseUntil) > now) return null;
    tx.set(stateRef, { ...state, leaseId, leaseUntil: new Date(now + 90000), lastStartedAt: new Date(now) });
    return state.cursor || '';
  });
  if (cursor === null) return { busy: true };
  const counts = { processed: 0, notified: 0, deduplicated: 0, paused: 0, completed: 0, skipped: 0, errors: 0, pushAccepted: 0 };
  let last = cursor, finishedPage = false, morePush = false;
  try {
    let query = db.collection(TASKS).where('status', '==', 'open').orderBy('__name__');
    if (cursor) query = query.startAfter(cursor);
    const snapshot = scanTasks || cursor ? await query.limit(51).get() : { docs: [], size: 0 };
    const rows = snapshot.docs.slice(0, 50);
    for (const doc of rows) {
      if (Date.now() >= deadline - 5000) break;
      try { const outcome = await processTask(db, doc.id, now); counts[outcome]++; }
      catch { counts.errors++; }
      counts.processed++; last = doc.id;
    }
    finishedPage = counts.processed === rows.length && snapshot.size <= 50;
    if (sendPush && Date.now() < deadline - 8000) {
      const pending = await db.collection(NOTIFICATIONS).where('pushState', '==', 'pending').orderBy('__name__').limit(21).get();
      let handled = 0;
      for (const doc of pending.docs.slice(0, 20)) {
        if (Date.now() >= deadline - 8000) break;
        const state = await dispatchPush(db, doc.ref, sendPush, now, Math.min(7000, Math.max(1, deadline - Date.now() - 3000)));
        handled++; if (state === 'accepted') counts.pushAccepted++;
      }
      morePush = pending.size > handled;
    } else if (sendPush) {
      morePush = true;
    }
    await db.runTransaction(async tx => {
      const current = (await tx.get(stateRef)).data(); if (current?.leaseId !== leaseId) return;
      tx.set(stateRef, { ...current, leaseUntil: new Date(0), cursor: finishedPage ? '' : last, lastCompletedAt: new Date(), counts });
    });
    return { ...counts, more: !finishedPage, morePush };
  } catch {
    await db.runTransaction(async tx => { const current = (await tx.get(stateRef)).data(); if (current?.leaseId === leaseId) tx.set(stateRef, { ...current, leaseUntil: new Date(0), lastFailedAt: new Date(), cursor: last }); });
    throw new Error('AUTOMATION_FAILED');
  }
}
