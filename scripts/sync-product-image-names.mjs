import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildProductImageIndex, mergeDiscoveredProductImageNames } from '../app/lib/productImageNames.mjs';

const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const { initializeApp, cert, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const apply = process.argv.includes('--apply');
const bucketName = process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'horecakatalog-e2d10.firebasestorage.app';
const app = initializeApp({ credential: cert({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}), storageBucket: bucketName }, 'product-image-sync');
const db = getFirestore(app);

try {
  const [snapshot, [files]] = await Promise.all([
    db.collection('products').get(),
    getStorage(app).bucket().getFiles({ prefix: 'product_images/' }),
  ]);
  const imageIndex = buildProductImageIndex(files.map(file => file.name.slice('product_images/'.length)));
  const changes = snapshot.docs.flatMap(doc => {
    const data = doc.data();
    const next = mergeDiscoveredProductImageNames({ ...data, id: doc.id }, imageIndex);
    if (JSON.stringify(data.image_names || []) === JSON.stringify(next)) return [];
    return [{ doc, backup: {
      id: doc.id, hadImageNames: Object.hasOwn(data, 'image_names'),
      before: data.image_names ?? null, after: next,
      updateTime: doc.updateTime.toDate().toISOString(),
    } }];
  });
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', products: snapshot.size,
    storageObjects: files.length, changedProducts: changes.length,
    addedReferences: changes.reduce((sum, { backup }) => sum + backup.after.filter(name =>
      !Array.isArray(backup.before) || !backup.before.includes(name)).length, 0) }));

  if (apply && changes.length) {
    const backupDir = path.resolve('.local-backups/product-images');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      bucket: bucketName, changes: changes.map(item => item.backup) }, null, 2), { flag: 'wx' });
    console.log(`Backup: ${backupPath}`);
    let updated = 0;
    for (let offset = 0; offset < changes.length; offset += 200) {
      const batch = db.batch();
      for (const { doc, backup } of changes.slice(offset, offset + 200)) {
        // Abort this batch if a product was edited after the inventory read.
        // Only image_names changes; prices, other metadata and timestamps stay intact.
        batch.update(doc.ref, { image_names: backup.after }, { lastUpdateTime: doc.updateTime });
      }
      await batch.commit();
      updated += Math.min(200, changes.length - offset);
      console.log(`Updated: ${updated}/${changes.length}`);
    }
  }
} catch (error) {
  console.error(`Image sync failed: ${error.code || error.name}`);
  process.exitCode = 1;
} finally {
  await db.terminate();
  await deleteApp(app);
}
