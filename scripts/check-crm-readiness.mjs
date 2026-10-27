import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const configured = key => !!process.env[key];
const groups = {
  automation: ['CRON_SECRET'], browserPush: ['NEXT_PUBLIC_FIREBASE_VAPID_KEY', 'FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY'],
  whatsapp: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_GRAPH_API_VERSION'],
};
const missing = Object.fromEntries(Object.entries(groups).map(([name, keys]) => [name, keys.filter(key => !configured(key))]));
let schedule = null; try { schedule = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8')).crons?.find(item => item.path === '/api/jobs/crm-followups')?.schedule || null; } catch { /* Missing schedule is reported below. */ }
console.log(JSON.stringify({ localConfigurationOnly: true, dailySchedule: schedule,
  enabled: { automation: process.env.CRM_AUTOMATION_ENABLED === 'true', browserPush: process.env.CRM_BROWSER_PUSH_ENABLED === 'true', inbox: process.env.WHATSAPP_INBOX_ENABLED === 'true', sending: process.env.WHATSAPP_SEND_ENABLED === 'true', templateSending: process.env.WHATSAPP_TEMPLATE_SEND_ENABLED === 'true' },
  cronSecretLongEnough: (process.env.CRON_SECRET || '').length >= 32, missing,
  notVerified: ['hosting environment', 'Firestore TTL', 'FCM API and VAPID registration', 'real browser delivery', 'Meta templates and live message delivery', 'full production generation and authenticated acceptance'] }, null, 2));
