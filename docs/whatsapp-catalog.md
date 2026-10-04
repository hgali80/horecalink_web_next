# WhatsApp Catalog

Admin product list: `/satissitok/admin/products`. WhatsApp is independent of Web. The checkbox is the desired publication preference; a failed sync keeps that preference and shows an error. Use **Yenile** to retry. Saving a published product synchronizes its name, specs, price and image list. Excel import synchronizes changed published products and removes deleted products, reporting `whatsappFailures` separately. Large imports queue remaining items as `whatsappPending` after a bounded immediate sync window; the scheduler completes them. Yenile is available for both publication and removal retries.

## Server secrets

- `META_CATALOG_ACCESS_TOKEN`: CatalogManager system-user token with `catalog_management` and access to the catalog. Never use a `NEXT_PUBLIC_` variable for this token.
- `META_CATALOG_ID=1610542617193791`
- `META_GRAPH_API_VERSION=v26.0`
- `META_CATALOG_RECONCILE_SECRET`: independent random secret for the scheduled endpoint.

App ID: `1127935516338809`. The app ID is setup context, not an API authentication credential. Existing setup tokens are temporary. **Rotate the token before production**, place the replacement in hosting secrets, and revoke the old token. Do not paste credentials into logs, source, tickets or screenshots.

## Scheduled reconciliation (required for production)

Configure the hosting scheduler to POST `/api/admin/products/whatsapp-reconcile` with `Authorization: Bearer <META_CATALOG_RECONCILE_SECRET>` every five minutes. Follow `nextCursor` by posting `{ "cursor": "..." }` until it is null. Each new scheduled run starts with `{}`. This checks current product records, retries failures, handles image maintenance changes and removes previously synced deleted/unpublished records. A missing scheduler means changes made outside the product editor/import wait until a manual retry.

Do not equate API success with immediate appearance in WhatsApp: catalog channel ingestion and image fetching may take time. Meta API errors remain visible, with no token or raw upstream message persisted.

Deploy `firestore.rules` together with the app: publication changes are server-only, sync metadata is manager-readable and server-writable, and direct deletion of a published product is blocked. Existing Web fields and public filtering are unchanged. A Web-unpublished product can have an inaccessible public product link; the list shows a warning. This integration does not expose unpublished web pages.

## Mapping

SKU -> `retailer_id`; Russian `name_ru` or the existing Russian `name` -> `name`; `specs` plus structured technical properties -> `description`; KZT price -> integer minor units and `currency=KZT`; brand -> `brand`; fixed `availability=available for order` (orderable, without an inventory claim). ERP stock, quantities and `stockTracked` are never read or used by this integration. No `inventory` or `quantity_to_sell_on_facebook` field is sent. No stock wording is added to the product name or description. Meta controls WhatsApp channel labels; verify the customer-facing display in the live acceptance test. SKU duplication blocks sync.

Public product canonical URL -> `url`. Web image list/order -> `image_url` plus at most 20 `additional_image_urls`. Sending an empty additional image array removes old extras. More than 21 images are capped at the supported limit.

Verified official sources: Meta Business SDK ProductItem update schema (`additional_image_urls: list<string>`) and Meta WooCommerce integration `get_additional_image_urls` (20 extras). Direct developers.facebook.com documentation returned HTTP 429 during implementation. v26.0 live behavior still needs the SKU test below.

- https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/productitem.py
- https://github.com/facebook/facebook-for-woocommerce/blob/main/includes/fbproduct.php

## Validation and live acceptance

Run `node scripts/test-whatsapp-catalog.mjs` and `node scripts/test-whatsapp-sync.mjs` (15 tests for payload mapping, API requests, lease locking, failure recovery and reconciliation). In a configured environment, use SKU **102385**: publish (existing SKU updates rather than duplicates), change price/specs/images, save and verify the remote item; remove an extra image and verify it disappears; uncheck WhatsApp and verify remote deletion. Confirm Web stays unchanged throughout. Confirm the WhatsApp view does not show in-stock/out-of-stock wording and that zero ERP inventory does not hide or disable the product; the API enum is supported, but channel presentation still needs live verification. Validate WhatsApp display separately. No live catalog mutation is performed by the automated tests.

Live read-only inspection of SKU 102385 confirmed Russian name, brand VEIRO, price 4000 KZT, four stored web images. Stock is outside the integration scope. META_CATALOG_ACCESS_TOKEN and META_CATALOG_RECONCILE_SECRET were absent locally; live Meta mutations and WhatsApp channel acceptance were not run.

## Products without prices

Blank or zero website prices omit price/currency on CREATE and append `Цену уточняйте` to the description. Negative, malformed and unrepresentable prices are rejected. UPDATE explicitly requests clearing price and sale_price and reads them back to prevent a stale price being reported as synchronized. Meta acceptance of omitted/cleared prices and WhatsApp rendering require a live test after deployment; SDK parameter listings do not establish server acceptance. No fabricated zero price is sent.
