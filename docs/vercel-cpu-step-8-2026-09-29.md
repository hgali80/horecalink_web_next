# Vercel CPU optimization — step 8

Date: 2026-09-29

## Goal

Avoid separate full published-product reads for the product and catalog
sitemaps, and serve repeated crawler requests without a Vercel Function run.

## Changes

- The published product summary used by sitemaps now has a shared tagged
  Next.js data cache with a one-hour fallback lifetime.
- Product and catalog sitemap generation use the same cached product list.
- All four sitemap routes are now static ISR routes with one-hour revalidation.
- Product create, edit, visibility changes and completed imports invalidate both
  the shared product cache and the two product-dependent sitemap routes.
- Catalog sitemap keys are normalized to canonical catalog paths, matching the
  routes pre-rendered in step 7.
- Error-free XML response caching remains one hour with a one-day stale window.

## Expected effect

Repeated crawler requests are served from the generated sitemap response. When
regeneration is needed, the product and catalog sitemaps share one cached product
summary rather than independently reading and normalizing the full collection.

## Validation

- Targeted ESLint: passed.
- Product query regression tests: passed (2 tests; optional live test skipped).
- Production build: passed; 316 static pages/routes generated.
- `/sitemap.xml`, `/sitemap-static.xml`, `/sitemap-products.xml` and
  `/sitemap-catalog.xml` changed from dynamic (`ƒ`) to static ISR (`○`).
- All four sitemap responses returned HTTP 200 and XML content types.
- Sitemap index: 3 child sitemaps.
- Static sitemap: 21 URLs.
- Product sitemap: 1,439 published product URLs.
- Catalog sitemap: 239 catalog URLs.
- Product sitemap returned `x-nextjs-cache: HIT` with `s-maxage=3600`.
- Catalog sitemap contains canonical `/catalog/stainless-steel` paths and no
  legacy `/catalog/paslanmaz` paths.
