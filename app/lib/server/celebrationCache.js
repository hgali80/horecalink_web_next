import 'server-only';
import { unstable_cache, revalidateTag } from 'next/cache';
import { getAdminServices } from './firebaseAdmin';
import { normalizeCelebration } from '../celebrations';

export const CELEBRATION_CACHE_TAG = 'site-content-celebrations';
export const getPublicCelebration = unstable_cache(async () => {
  const { adminDb } = getAdminServices();
  const snapshot = await adminDb.collection('siteContent').doc('celebrations').get();
  return normalizeCelebration(snapshot.data());
}, ['site-content-celebrations-v1'], { revalidate: 3600, tags: [CELEBRATION_CACHE_TAG] });

export function invalidateCelebration() {
  revalidateTag(CELEBRATION_CACHE_TAG);
}
