import { randomUUID } from 'node:crypto';
import { authorizeWhatsAppRequest, inboxJson, inboxIso } from '@/app/lib/server/whatsappInbox';
import { TASKS, identifier, invalid, validateCreate, validateChange, transition } from '@/app/lib/crmFollowups.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const SOURCES = { customer: 'erp_caris', offer: 'commercial_offers', conversation: 'whatsapp_conversations' };
async function source(db, type, id) {
  if (!SOURCES[type]) throw invalid('Bağlantı türü geçersiz.');
  const snap = await db.collection(SOURCES[type]).doc(identifier(id)).get();
  if (!snap.exists) throw invalid('Bağlanacak kayıt bulunamadı.', 404);
  const data = snap.data();
  if (type === 'offer') return { customerName: data.buyer?.companyName || data.buyer?.contactName || '', phone: data.buyer?.phone || '', label: data.offerNo || id };
  if (type === 'conversation') return { customerName: data.contactName || data.senderId || '', phone: data.senderId || '', label: data.contactName || data.senderId || id, incomingRevision: data.lastIncomingRevision || String(data.lastIncomingAt?.toMillis?.() || data.lastIncomingAt?.getTime?.() || 0) };
  return { customerName: data.name || data.companyName || data.contactName || '', phone: data.phone || data.mobile || '', label: data.name || id };
}
async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) throw invalid('İstek boş.');
  let size = 0; const parts = [];
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 16384) { await reader.cancel(); throw invalid('İstek çok büyük.', 413); } parts.push(value); }
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch (error) { if (error.status) throw error; throw invalid('İstek geçersiz.'); }
  finally { reader.releaseLock(); }
}
const serialize = doc => {
  const data = doc.data();
  return { id: doc.id, ...data, dueAt: inboxIso(data.dueAt), createdAt: inboxIso(data.createdAt), updatedAt: inboxIso(data.updatedAt), closedAt: inboxIso(data.closedAt) };
};
function failure(error) { return inboxJson({ error: error.status ? error.message : 'Takip işlemi tamamlanamadı. Lütfen yeniden deneyin.' }, error.status || 503); }

export async function GET(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    const params = new URL(request.url).searchParams;
    if (params.has('sourceType')) return inboxJson(await source(auth.adminDb, params.get('sourceType'), params.get('sourceId')));
    if (params.has('options')) {
      const type = params.get('options');
      if (!SOURCES[type]) throw invalid('Bağlantı türü geçersiz.');
      const collection = auth.adminDb.collection(SOURCES[type]);
      const fields = type === 'offer' ? ['buyer', 'offerNo'] : type === 'customer' ? ['name', 'companyName', 'contactName', 'phone', 'mobile'] : ['contactName', 'senderId'];
      let query = collection.orderBy('__name__').select(...fields);
      if (params.get('cursor')) query = query.startAfter(identifier(params.get('cursor')));
      const snap = await query.limit(31).get();
      return inboxJson({ options: snap.docs.slice(0, 30).map(doc => {
        const data = doc.data();
        return { id: doc.id, label: type === 'offer' ? String(data.offerNo || doc.id) : String(data.name || data.companyName || data.contactName || data.senderId || 'İsimsiz kayıt'),
          customerName: String(type === 'offer' ? data.buyer?.companyName || data.buyer?.contactName || '' : data.name || data.companyName || data.contactName || data.senderId || ''),
          phone: String(type === 'offer' ? data.buyer?.phone || '' : data.phone || data.mobile || data.senderId || '') };
      }), nextCursor: snap.size > 30 ? snap.docs[29].id : null });
    }
    if (params.has('id')) {
      const task = await auth.adminDb.collection(TASKS).doc(identifier(params.get('id'))).get();
      if (!task.exists) throw invalid('Takip bulunamadı.', 404);
      return inboxJson({ tasks: [serialize(task)], nextCursor: null });
    }
    const status = params.get('status') || 'open';
    if (!['open', 'paused', 'completed', 'cancelled'].includes(status)) throw invalid('Durum geçersiz.');
    const collection = auth.adminDb.collection(TASKS);
    // Equality query needs only Firestore's automatic single-field index. Pagination is by document ID.
    let query = collection.where('status', '==', status).orderBy('__name__');
    if (params.get('cursor')) {
      const cursor = await collection.doc(identifier(params.get('cursor'))).get();
      if (!cursor.exists || cursor.data().status !== status) throw invalid('Liste değişti. Listeyi yenileyin.', 409);
      query = query.startAfter(cursor);
    }
    const snapshot = await query.limit(51).get();
    return inboxJson({ tasks: snapshot.docs.slice(0, 50).map(serialize), nextCursor: snapshot.size > 50 ? snapshot.docs[49].id : null });
  } catch (error) { return failure(error); }
}

export async function POST(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    const body = await readBody(request), fields = validateCreate(body), id = identifier(body.id);
    const labels = {}; let baselineRevision = '';
    for (const [type, key] of [['customer', 'customerId'], ['offer', 'offerId'], ['conversation', 'conversationId']]) {
      if (fields[key]) { const linked = await source(auth.adminDb, type, fields[key]); labels[type] = linked.label; if (type === 'conversation') baselineRevision = linked.incomingRevision; }
    }
    const ref = auth.adminDb.collection(TASKS).doc(id), now = new Date();
    await auth.adminDb.runTransaction(async tx => {
      const old = await tx.get(ref);
      if (old.exists) { if (old.data().createdBy !== auth.uid) throw invalid('Kayıt kimliği kullanılıyor.', 409); return; }
      tx.create(ref, { ...fields, labels, status: 'open', assignedTo: auth.uid, createdBy: auth.uid, updatedBy: auth.uid,
        createdAt: now, updatedAt: now, closedAt: null, revision: randomUUID(), notificationCycle: randomUUID(), followupBaselineRevision: baselineRevision, followupBaselineAt: now, timeZone: 'Asia/Qyzylorda' });
      tx.create(ref.collection('events').doc(), { action: 'created', actor: auth.uid, at: now, dueAt: fields.dueAt });
    });
    return inboxJson({ ok: true, id });
  } catch (error) { return failure(error); }
}

export async function PATCH(request) {
  try {
    const auth = await authorizeWhatsAppRequest(request); if (!auth.ok) return auth.response;
    const change = validateChange(await readBody(request)), ref = auth.adminDb.collection(TASKS).doc(change.id), now = new Date();
    await auth.adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref); if (!snap.exists) throw invalid('Takip bulunamadı.', 404);
      const current = snap.data(), update = transition(current, change, now);
      if (['reschedule', 'reopen'].includes(change.action)) {
        const conversation = current.conversationId ? (await tx.get(auth.adminDb.collection('whatsapp_conversations').doc(current.conversationId))).data() : null;
        Object.assign(update, { notificationCycle: randomUUID(), followupBaselineAt: now, followupBaselineRevision: conversation?.lastIncomingRevision || String(conversation?.lastIncomingAt?.toMillis?.() || conversation?.lastIncomingAt?.getTime?.() || 0), automationReason: null });
      }
      tx.update(ref, { ...update, revision: randomUUID(), updatedAt: now, updatedBy: auth.uid });
      tx.create(ref.collection('events').doc(), { action: change.action, actor: auth.uid, at: now, previousStatus: current.status,
        previousDueAt: current.dueAt, dueAt: update.dueAt || current.dueAt });
    });
    return inboxJson({ ok: true });
  } catch (error) { return failure(error); }
}
