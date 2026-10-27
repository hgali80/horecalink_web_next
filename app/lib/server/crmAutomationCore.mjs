import { createHash } from 'node:crypto';
export const NOTIFICATIONS = 'crm_notifications';
export const SUBSCRIPTIONS = 'crm_push_subscriptions';
export const STATE = 'crm_automation_state';
export const hash = value => createHash('sha256').update(value).digest('hex');
export const milliseconds = value => value?.toMillis?.() ?? value?.getTime?.() ?? 0;
export function notificationId(taskId, task) {
  return `${String(milliseconds(task.dueAt)).padStart(13, '0')}_${hash(`${taskId}:${task.notificationCycle || milliseconds(task.createdAt)}:${milliseconds(task.dueAt)}`)}`;
}
export function automationDecision(task, { conversation, preference, offer, sale, now = Date.now() } = {}) {
  if (task.status !== 'open') return { action: 'skip' };
  if (sale && ['confirmed', 'completed'].includes(sale.status) && !sale.cancelledAt && sale.sourceCommercialOfferId === task.offerId) return { action: 'complete', reason: 'sale_confirmed' };
  if ((task.offerId && !offer) || (task.conversationId && !conversation)) return { action: 'pause', reason: 'source_missing' };
  if (['offer', 'silent'].includes(task.kind)) {
    if (preference?.status === 'revoked') return { action: 'pause', reason: 'permission_revoked' };
    if (conversation) {
      const scheduled = milliseconds(task.followupBaselineAt) || milliseconds(task.createdAt);
      const sent = milliseconds(task.lastFollowupSentAt);
      const baseline = Math.max(scheduled, sent);
      const revision = sent > scheduled ? task.lastFollowupBaseRevision : task.followupBaselineRevision;
      const currentRevision = conversation.lastIncomingRevision || String(milliseconds(conversation.lastIncomingAt));
      const incoming = milliseconds(conversation.lastIncomingAt);
      if (incoming > baseline || (revision && revision !== currentRevision && incoming >= baseline - 1000)) return { action: 'pause', reason: 'customer_replied' };
    }
  }
  if (milliseconds(task.dueAt) > 0 && milliseconds(task.dueAt) <= now) return { action: 'notify', reason: 'due' };
  return { action: 'skip' };
}
export function notificationCurrent(notification, task) {
  if (!task || notificationId(notification.taskId, task) !== notification.id) return false;
  return notification.kind === 'review' ? task.status === 'paused' : notification.kind === 'resolved' ? task.status === 'completed' : task.status === 'open';
}
