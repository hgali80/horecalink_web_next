# Vercel CPU optimization — step 6

Date: 2026-09-27

## Goal

Stop reading the same public home banner and category image settings from
Firestore on every visit, and avoid invoking a Vercel Function for cache hits.

## Changes

- `/api/home-banner` and `/api/category-images` are now static Next.js route
  handlers with one-hour revalidation.
- Firestore results also use tagged Next.js data cache entries with a one-hour
  fallback lifetime.
- Successful admin banner updates invalidate the banner data tag and route.
- Successful admin category image updates invalidate the category image data tag
  and route.
- Cache invalidation failures do not turn an already committed admin update into
  a false save error. The one-hour fallback still refreshes the data.
- Public and admin browser fetches no longer opt out with `cache: "no-store"`,
  allowing the generated route response to be served from Next.js/Vercel cache.
- Error responses remain `no-store`.

## Expected effect

Normal visits receive the generated JSON response from the Next.js/Vercel cache.
They no longer need a Vercel Function execution or Firestore document read until
the content is changed or the one-hour fallback expires.

## Validation

- Targeted ESLint: passed.
- Production build: passed.
- Build output changed both public APIs from dynamic (`ƒ`) to static (`○`).
- Build output reports a one-hour revalidation interval for both APIs.
- Local production requests returned the current banner and category image data.
- Both responses returned `x-nextjs-cache: HIT` and
  `Cache-Control: s-maxage=3600`.

Cache behavior follows the official Next.js 15 data/full-route cache model and
Vercel's CDN cache-control behavior:

- https://nextjs.org/docs/15/app/guides/caching
- https://vercel.com/docs/caching/cache-control-headers
