'use client';
import { app, auth } from '@/firebase/index';
const KEY = 'horecalink_crm_push';
let operation = 0;
async function call(options) {
  const user = auth.currentUser; if (!user) throw new Error('Oturum açmanız gerekiyor.');
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== user.uid) throw new Error('Oturum değişti.');
  const response = await fetch('/api/admin/crm/notifications/subscription', { ...options, cache: 'no-store', signal: AbortSignal.timeout(5000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Bildirim kaydı tamamlanamadı.'); return data;
}
export async function enableCrmPush({ prompt = true } = {}) {
  const generation = ++operation;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) throw new Error('Bu tarayıcı bildirimleri desteklemiyor.');
  const uid = auth.currentUser?.uid;
  const config = await call();
  if (!config.enabled || !config.vapidKey) throw new Error('Tarayıcı bildirimi sunucuda henüz etkinleştirilmedi.');
  const permission = prompt ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') throw new Error('Tarayıcı bildirim izni verilmedi.');
  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) throw new Error('Bu tarayıcıda bildirim kullanılamıyor.');
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/crm-push/' });
  if (!registration.active) await new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) { reject(new Error('Bildirim servisi başlatılamadı.')); return; }
    const timer = setTimeout(() => reject(new Error('Bildirim servisi henüz hazır değil.')), 10000);
    const ready = () => { if (worker.state === 'activated') { clearTimeout(timer); resolve(); } };
    worker.addEventListener('statechange', ready); ready();
  });
  const token = await getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (generation !== operation) throw new Error('Bildirim kaydı iptal edildi.');
  if (!token || auth.currentUser?.uid !== uid) throw new Error('Oturum değişti. Bildirim kaydını yeniden deneyin.');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const pendingId = [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(KEY, JSON.stringify({ id: pendingId, uid }));
  let result;
  try { result = await call({ method: 'POST', body: JSON.stringify({ token }) }); }
  catch (error) { try { await disableCrmPush(); } catch { /* Preserve the original registration error. */ } throw error; }
  if (generation !== operation || auth.currentUser?.uid !== uid) {
    if (auth.currentUser?.uid === uid) { try { await call({ method: 'DELETE', body: JSON.stringify({ id: result.id }) }); } catch { /* Token is locally unsubscribed and expires server-side. */ } }
    throw new Error('Bildirim kaydı iptal edildi.');
  }
  localStorage.setItem(KEY, JSON.stringify({ id: result.id, uid }));
  return result;
}
export function savedCrmPush() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export async function disableCrmPush() {
  operation++;
  const saved = savedCrmPush(); let failure = null;
  try { if (saved?.id && auth.currentUser?.uid === saved.uid) await call({ method: 'DELETE', body: JSON.stringify({ id: saved.id }) }); } catch (error) { failure = error; }
  try { if ('serviceWorker' in navigator) { const registration = await navigator.serviceWorker.getRegistration('/crm-push/'); const subscription = await registration?.pushManager.getSubscription(); await subscription?.unsubscribe(); await registration?.unregister(); } } catch { /* Local subscription may already be gone. */ }
  try { const { getMessaging, deleteToken, isSupported } = await import('firebase/messaging'); if (await isSupported()) await deleteToken(getMessaging(app)); } catch { /* Server expiration and invalid-token cleanup remain available. */ }
  localStorage.removeItem(KEY);
  if (failure) throw new Error('Bu tarayıcıda bildirim kapatıldı; sunucu kaydı bağlantı sağlandığında sona erecek.');
}
export async function listenCrmPush(callback) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return () => {};
  const { getMessaging, onMessage, isSupported } = await import('firebase/messaging');
  if (!(await isSupported())) return () => {};
  return onMessage(getMessaging(app), async payload => {
    if (payload.data?.type !== 'crm_due') return;
    const uid = auth.currentUser?.uid; if (!uid) return;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(uid));
    const owner = [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (payload.data.ownerHash !== owner || auth.currentUser?.uid !== uid) return;
    callback();
    const registration = await navigator.serviceWorker.getRegistration('/crm-push/');
    try { await registration?.showNotification('Takip zamanı', { body: 'Bekleyen müşteri takiplerinizi yönetim panelinden kontrol edin.', tag: payload.data.notificationId }); } catch { /* Browser permission may have changed; panel notification remains available. */ }
  });
}
