# Vercel CPU optimization — step 5

Date: 2026-09-27

## Goal

Cache public product detail pages across visits so repeated requests do not run
the same Firestore product, related-product and family-variant queries.

## Changes

- `/products/[slug]` now uses on-demand ISR with a one-hour fallback lifetime.
- Product, related-product and family-variant data share one tagged Next.js data
  cache entry per slug.
- Metadata and page rendering reuse the same cached result within a request.
- Product create, edit, publish/unpublish and bulk status updates request a cache
  refresh after their Firestore write succeeds.
- A completed non-dry-run Excel import also refreshes the product cache.
- Cache refresh is exposed only through an authenticated admin endpoint and is
  restricted to `admin` and `super_admin` roles.
- If an invalidation request temporarily fails, the product write remains
  successful and the one-hour ISR lifetime provides an automatic fallback.

## Expected effect

The first request for a product slug renders the page and fills the cache.
Subsequent visits are served from Next.js/Vercel cache until the product catalog
changes or the one-hour fallback expires. This removes repeated Firestore work
and most server rendering CPU from frequently visited product pages.

## Validation

- Targeted ESLint: passed.
- Product query regression tests: passed (2 tests; optional live test skipped).
- Product image regression tests: passed (3 tests; optional live test skipped).
- Production build: passed.
- Build output reports `/products/[slug]` as SSG/on-demand ISR (`●`).
- Local production request: first response `x-nextjs-cache: MISS`, second response
  `x-nextjs-cache: HIT`, with `Cache-Control: s-maxage=3600`.
- Anonymous cache invalidation request: rejected with HTTP 401.

The local production request could not read live Firestore data because the
sandbox blocks outbound Firebase traffic. It still verified the generated
route's cache lifecycle and headers; the production build completed normally.
