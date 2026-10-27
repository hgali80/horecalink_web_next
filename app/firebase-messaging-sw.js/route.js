import { firebaseConfig } from '@/firebase/config';
export const dynamic = 'force-dynamic';
export function GET() {
  const script = `self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.openWindow('/satissitok/admin/crm'));
  });
  importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');
  firebase.initializeApp(${JSON.stringify(firebaseConfig)});
  firebase.messaging().onBackgroundMessage(payload => {
    if (payload.data?.type !== 'crm_due' || !/^[a-zA-Z0-9_-]{1,128}$/.test(payload.data.notificationId || '')) return;
    return self.registration.showNotification('Takip zamanı', {
      body: 'Bekleyen müşteri takiplerinizi yönetim panelinden kontrol edin.',
      icon: '/favicon-32x32.png', tag: payload.data.notificationId, renotify: false
    });
  });`;
  return new Response(script, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache, no-store', 'Service-Worker-Allowed': '/crm-push/', 'X-Content-Type-Options': 'nosniff' } });
}
