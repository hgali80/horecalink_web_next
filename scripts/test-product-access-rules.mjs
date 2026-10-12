// Run against a local Firestore emulator only:
// npm install --no-save --package-lock=false @firebase/rules-unit-testing@5.0.0
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 node scripts/test-product-access-rules.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, deleteField, where, getCountFromServer } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host || !/^127\.0\.0\.1:\d+$/.test(host)) throw new Error('Local emulator required; live tests are forbidden.');
const rulesPath = process.argv[2] || 'firestore.rules';
const env = await initializeTestEnvironment({
  projectId: 'demo-horecalink-product-access',
  firestore: { host: '127.0.0.1', port: Number(host.split(':')[1]), rules: fs.readFileSync(rulesPath, 'utf8') },
});
const claims = { email: 'ordinary@example.invalid', phone_number: '+00000000000' };
let checks = 0;
async function succeeds(operation) { const result = await assertSucceeds(operation); checks++; return result; }
async function fails(operation) { await assertFails(operation); checks++; }
try {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [id, data] of Object.entries({
      visible: { active: true, webPublished: true },
      hidden: { active: true, webPublished: false },
      inactive: { active: false, webPublished: true },
      legacy: { name: 'Missing publication flags' },
    })) await setDoc(doc(db, 'products', id), data);
    for (const [uid, data] of Object.entries({
      ordinary: { role: 'user', isActive: true },
      admin: { role: 'admin', isActive: true },
      super: { role: 'super_admin', isActive: true },
      disabled: { role: 'admin', isActive: false },
      inactiveUser: { role: 'user', isActive: false },
    })) await setDoc(doc(db, 'users', uid), data);
  });
  const publicQuery = db => query(collection(db, 'products'), where('active', '==', true), where('webPublished', '==', true));
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('ordinary', claims).firestore()]) {
    await succeeds(getDoc(doc(db, 'products', 'visible')));
    for (const id of ['hidden', 'inactive', 'legacy']) await fails(getDoc(doc(db, 'products', id)));
    await fails(getDocs(collection(db, 'products')));
    await fails(getDocs(query(collection(db, 'products'), where('active', '==', true))));
    assert.equal((await succeeds(getDocs(publicQuery(db)))).size, 1);
    const linked = await Promise.all(['visible', 'hidden', 'inactive', 'deleted'].map(async id => {
      try { const snap = await getDoc(doc(db, 'products', id)); return snap.exists() ? snap.id : null; }
      catch (error) { if (error.code === 'permission-denied') return null; throw error; }
    }));
    assert.deepEqual(linked.filter(Boolean), ['visible']);
    checks++;
    await fails(setDoc(doc(db, 'products', 'unauthorized'), { active: true, webPublished: true }));
  }
  for (const uid of ['admin', 'super', '8hV0aS1izsf7rIvbeeJ6JIPDh3I2']) {
    const db = env.authenticatedContext(uid, claims).firestore();
    await succeeds(getDoc(doc(db, 'products', 'hidden')));
    assert.equal((await succeeds(getDocs(collection(db, 'products')))).size, 4);
    assert.equal((await succeeds(getCountFromServer(collection(db, 'products')))).data().count, 4);
  }
  const disabled = env.authenticatedContext('disabled', claims).firestore();
  await fails(getDoc(doc(disabled, 'products', 'hidden')));
  await fails(getDocs(collection(disabled, 'products')));
  const ordinary = env.authenticatedContext('ordinary', claims).firestore();
  await succeeds(updateDoc(doc(ordinary, 'users', 'ordinary'), { fullName: 'Profile edit' }));
  await fails(updateDoc(doc(ordinary, 'users', 'ordinary'), { role: 'admin' }));
  await fails(updateDoc(doc(ordinary, 'users', 'ordinary'), { isActive: false }));
  await fails(updateDoc(doc(ordinary, 'users', 'ordinary'), { role: deleteField() }));
  const fresh = env.authenticatedContext('fresh', claims).firestore();
  await fails(setDoc(doc(fresh, 'users', 'fresh'), { role: 'super_admin', isActive: true }));
  await succeeds(setDoc(doc(fresh, 'users', 'fresh'), { role: 'user', isActive: true }));
  await fails(deleteDoc(doc(disabled, 'users', 'disabled')));
  const inactiveUser = env.authenticatedContext('inactiveUser', claims).firestore();
  await fails(deleteDoc(doc(inactiveUser, 'users', 'inactiveUser')));
  const owner = env.authenticatedContext('8hV0aS1izsf7rIvbeeJ6JIPDh3I2', claims).firestore();
  await succeeds(updateDoc(doc(owner, 'users', 'ordinary'), { role: 'admin' }));
  await succeeds(updateDoc(doc(owner, 'products', 'hidden'), { name: 'Admin edit' }));
  console.log(`${checks} security checks passed (${rulesPath}).`);
} catch (error) {
  console.error(`Security check failed after ${checks} completed checks.`);
  throw error;
} finally {
  await env.cleanup();
}
