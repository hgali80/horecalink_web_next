# Vercel CPU optimization — step 7

Date: 2026-09-29

## Goal

Pre-render the known public catalog hierarchy so visitors and crawlers receive a
generated page instead of invoking server rendering for every catalog URL.

## Changes

- Added static parameter generation from the canonical catalog data.
- Pre-rendered 3 group routes, 36 category routes and 200 subcategory routes.
- Added a Suspense loading boundary required by the client-side URL filters.
- Search, brand filtering, sorting and pagination remain client-side and keep
  using the existing URL query parameters.
- Unknown and legacy catalog paths retain the existing on-demand fallback. This
  keeps old links such as `/catalog/paslanmaz` working.

## Expected effect

The 239 normal catalog paths are generated during deployment and served from the
Next.js/Vercel static cache. Normal visitors and search-engine crawlers no longer
need a server render for those route shells. Browser-side Firestore product reads
are unchanged in this step.

## Trade-off

Deployment builds now generate 239 additional pages, so build time is longer.
This moves work away from repeated production requests and into a single deploy
build, which is the intended trade-off for Fluid Active CPU reduction.

## Validation

- Static parameter counts: 3 groups, 36 categories and 200 subcategories.
- All 239 parameter objects are unique.
- Targeted ESLint: passed.
- Production build: passed; 312 total static pages generated.
- All three catalog route levels changed from dynamic (`ƒ`) to SSG (`●`).
- The prerender manifest contains all 239 catalog paths.
- Representative group, category and subcategory requests returned HTTP 200.
- A representative pre-rendered route returned `x-nextjs-cache: HIT` and
  `Cache-Control: s-maxage=31536000`.
- The legacy `/catalog/paslanmaz` path and a filtered/paginated query URL still
  returned HTTP 200.
