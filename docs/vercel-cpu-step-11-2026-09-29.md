# Vercel and Firestore optimization — step 11

Date: 2026-09-29

## Goal

Stop the admin product list from downloading and rendering the entire Firestore product collection on every visit.

## Changes

- The product management page initially loads 100 products instead of the complete collection.
- A “load 100 more” action continues from the last Firestore document cursor.
- Active, passive, web and non-web filters are applied in Firestore before documents are downloaded.
- Overall status totals use Firestore count aggregations rather than full product downloads.
- Loaded batches are merged and kept sorted by stock code.
- When an administrator enters a search term, the remaining pages for the selected status are loaded after a short delay. This preserves the previous full substring search behavior while avoiding that cost during normal list visits.
- Product editors and product-selection screens keep their existing complete-catalog behavior because those screens need the full set.

## Expected effect

The live collection contained 1,450 products during validation. A normal product-management visit now downloads 100 product documents initially, approximately 93% fewer product documents. Additional reads happen only when the administrator requests more rows or performs a complete search.

These are browser-to-Firestore reads, so this step mainly reduces Firestore usage, browser memory, image requests and rendering work. It does not directly provide a large Vercel Active CPU reduction.

## Validation

- All five live Firestore query shapes passed without requiring a composite index.
- Live counts: 1,450 total, 1,450 active, 0 passive, 1,439 web and 11 non-web products.
- Targeted ESLint: passed.
- Production build: passed; 316 static pages/routes generated.
