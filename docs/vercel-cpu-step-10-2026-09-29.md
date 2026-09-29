# Vercel CPU optimization — step 10

Date: 2026-09-29

## Goal

Make the admin analytics card and detailed analytics screen cheaper to load without changing the figures shown to administrators.

## Changes

- The small dashboard card now uses a Firestore count aggregation for page views.
- The card no longer downloads and processes up to 5,000 page-view documents or resolves product names just to display today's three summary figures.
- Detailed analytics results are cached on the server for 60 seconds per date range.
- Refreshes and repeated opens during that window reuse the calculated result after authorization succeeds.
- Detailed Firestore queries now select only the fields used by the report.
- Product-name queries also select only the slug and translated name fields used by the dashboard.
- Invalid range values are normalized before they become cache keys.
- The browser-side Firebase fallback uses the same lightweight count aggregation for the summary card.
- Authorization still runs on every API request; only the expensive analytics calculation is shared.

## Expected effect

Opening the admin home page no longer transfers thousands of page-view records for its small analytics card. The detailed page still reads the records needed for charts and rankings, but repeated requests within 60 seconds avoid repeating those reads and calculations. The displayed data can be up to one minute behind live traffic.

## Validation

- Targeted ESLint: passed.
- Production build: passed; 316 static pages/routes generated.
- The analytics endpoint remains a protected dynamic route.
