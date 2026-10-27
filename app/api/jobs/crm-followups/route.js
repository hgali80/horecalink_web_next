import { getMessaging } from 'firebase-admin/messaging';
import { getAdminServices } from '@/app/lib/server/firebaseAdmin';
import { secretMatches } from '@/app/lib/server/whatsappInboxCore.mjs';
import { inboxJson } from '@/app/lib/server/whatsappInbox';
import { runAutomation } from '@/app/lib/server/crmAutomation';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request) {
  if (process.env.CRM_AUTOMATION_ENABLED !== 'true') return inboxJson({ error: 'Takip zamanlayıcısı etkin değil.' }, 503);
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !secretMatches(request.headers.get('authorization'), `Bearer ${secret}`)) return inboxJson({ error: 'Yetkisiz istek.' }, 401);
  try {
    const { adminDb, adminApp } = getAdminServices();
    const sendPush = process.env.CRM_BROWSER_PUSH_ENABLED === 'true' ? message => getMessaging(adminApp).sendEachForMulticast(message) : null;
    const started = Date.now(), totals = { processed: 0, notified: 0, paused: 0, completed: 0, errors: 0, pushAccepted: 0 };
    const deadline = started + 45000;
    let result = {}, pages = 0;
    do {
      result = await runAutomation(adminDb, { sendPush, deadline, scanTasks: pages === 0 || !!result.more }); pages++;
      for (const key of Object.keys(totals)) totals[key] += result[key] || 0;
    } while ((result.more || result.morePush) && !result.busy && pages < 20 && Date.now() < deadline - 8000);
    if (!result.busy) await adminDb.collection('crm_automation_state').doc('followups').set({ lastSweepAt: new Date(), lastSweepErrors: totals.errors, lastSweepMore: !!(result.more || result.morePush), lastSweepPages: pages }, { merge: true });
    return inboxJson({ ok: true, ...totals, pages, more: !!(result.more || result.morePush), busy: !!result.busy });
  } catch { return inboxJson({ error: 'Takip kontrolü tamamlanamadı.' }, 503); }
}
