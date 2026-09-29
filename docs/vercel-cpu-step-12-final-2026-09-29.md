# Vercel CPU optimization — step 12 final report

Date: 2026-09-29

## Final status

The 12-step optimization pass is complete and the project is ready for a Vercel deployment. The changes focus on removing repeated server work, increasing static/ISR coverage, sharing cached data and reducing avoidable analytics and Firestore traffic.

## Completed work

1. Audited public routes, API routes, Firebase access, rendering modes and cache behavior.
2. Shared product data between product-page metadata and page rendering within a request.
3. Replaced broad related-product and family-variant reads with narrow Firestore queries. Live comparison preserved results while reducing returned documents by about 96%.
4. Removed request-time Firebase Storage listing from product pages and migrated stored product image names.
5. Added one-hour tagged data caching and ISR behavior for product pages, with authenticated invalidation after product changes.
6. Added one-hour caching for home-banner and category-image data, with invalidation after admin changes.
7. Pre-rendered 239 canonical catalog routes: 3 groups, 36 categories and 200 subcategories.
8. Converted all four sitemap routes to one-hour static ISR and shared their published-product cache.
9. Batched visitor page views for up to 10 seconds, added stable event IDs and removed duplicate fallback writes. No analytics sampling is used.
10. Replaced the admin summary card's large page-view read with a count aggregation and cached detailed analytics for 60 seconds.
11. Paginated the admin product list. The live 1,450-document collection now initially downloads 100 product documents, about 93% fewer.
12. Completed full lint, regression, build and production smoke checks. Product galleries now trust migrated image-name lists instead of generating 12 unnecessary candidate requests.

## Expected effect

The largest Vercel Active CPU savings should come from product-page caching, removal of request-time Storage discovery, catalog pre-rendering, static sitemap responses and analytics request batching. The admin product-list change mainly reduces Firestore reads and browser work.

An exact CPU percentage cannot be calculated locally because it depends on traffic, crawler activity, cache hit rate and Vercel's runtime accounting. Compare the seven days before and after deployment in Vercel Usage, especially Fluid Active CPU, function invocations and duration by route.

## Final validation

- Full ESLint: passed with 0 errors and 10 existing non-blocking warnings.
- Regression tests: 17 passed; 2 opt-in live tests skipped; 0 failed.
- Production build: passed.
- Static generation: 316 pages/routes.
- Production smoke tests passed for `/`, representative group and subcategory catalog routes, four sitemap routes, home-banner API and category-image API.
- Empty analytics events return HTTP 200 without a database write.
- Unauthorized admin analytics requests return HTTP 401.
- Live Firestore pagination/count query shapes passed without a composite index.
- `git diff --check`: passed.

## Local smoke-test limitation

The first sitemap product URL returned a local 404 only while the sandboxed production server had no Firestore network access. Server logs confirmed a forced proxy connection failure (`127.0.0.1:9`). A follow-up network-enabled server run could not start because automatic approval review hit the account usage limit. The production build and the earlier read-only live Firestore product queries succeeded with network access.

## Deployment and monitoring

Deploy all changes together so cache producers, invalidation routes and consumers remain in sync. After deployment:

1. Open the home page and one product page.
2. Open one group, category and subcategory catalog page.
3. Check the four sitemap URLs.
4. Change one product in admin and confirm the public product page updates.
5. Change the home banner or category image and confirm the public result updates.
6. Confirm visitor analytics receives new page views and the admin summary loads.
7. Monitor Vercel Fluid Active CPU and function invocations for seven days.
