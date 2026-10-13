# WhatsApp inbox — phase 1

Panel: `/admin/whatsapp`, linked from `/satissitok/admin`. Only active `admin` and `super_admin` users can read inbox APIs. Every request verifies the Firebase ID token with revocation checks and reads the current user record. The client role check is navigation only; server checks protect the data.

This phase receives and lists incoming messages only. No OpenAI calls, reply drafts, send endpoint or outgoing message credential is added. Catalog services, credentials, product fields, imports and reconciliation are independent and unchanged.

## Server configuration (disabled by default)

Provide these values through hosting secrets, never source code or `NEXT_PUBLIC_` variables:

- `WHATSAPP_INBOX_ENABLED=true` — explicitly enables webhook GET/POST; absent or any other value returns 503.
- `WHATSAPP_APP_SECRET` — Meta app secret for raw-body HMAC verification.
- `WHATSAPP_VERIFY_TOKEN` — independently generated random webhook verification token.
- `WHATSAPP_WABA_ID` — expected WhatsApp Business Account ID.
- `WHATSAPP_PHONE_NUMBER_ID` — expected Cloud API phone number ID, not the displayed telephone number.
- Existing `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.

Do not reuse `META_CATALOG_ACCESS_TOKEN` or `META_CATALOG_RECONCILE_SECRET`. The inbox does not require an access token to accept signed webhook deliveries. Enabling account subscription in Meta is a separate administrative setup step, not performed by this code.

## Webhook

HTTPS callback: `/api/webhooks/whatsapp`. Subscribe the intended WABA/app to `messages`. Confirm phone registration and callback settings in Meta before a live test. GET validates `hub.mode`, verify token and numeric challenge. POST verifies `X-Hub-Signature-256` against the exact body bytes before parsing. Bodies are bounded at 512 KiB and 100 incoming messages per event. Matching entries and changes are all processed; foreign accounts/numbers and status-only events are acknowledged without storing them.

Text is stored and displayed as plain text. Other message types are recorded as unsupported without downloading media. This phase supports numeric WhatsApp sender IDs; nonnumeric sender IDs return 400 and require a later identity-model update before use. Malformed signed incoming events return 400; investigate repeated delivery failures without logging message bodies. Database failures return 503 for retry. A 200 is returned only after the normalized incoming batch is durably stored. A transaction makes repeated and concurrent deliveries idempotent, and older events cannot replace a newer conversation preview. No raw event, secret, media URL or upstream error is logged.

## Storage and privacy

`whatsapp_conversations/{sha256(phoneId:senderId)}` stores the conversation summary; `messages/{sha256(phoneId:metaMessageId)}` stores normalized messages. Browser access is denied in Firestore rules; Firebase Admin bypasses rules, so both API endpoints must retain server authorization. Existing rules deny unmatched collections by default; no production rules change is needed for this inbox. The local explicit deny block is documentation only and is excluded from the deployment. List endpoints are authenticated, paginated (30 conversations / 50 messages), and use `private, no-store`. The panel refreshes on demand and clears fetched data on request failures or sign-out.

Each new message has an `expiresAt` date 90 days after receipt. Conversation expiration follows its latest newly received message. **The date alone does not delete data.** Before production, approve the retention period and configure Firestore TTL separately for the `whatsapp_conversations` and `messages` collection groups. Parent deletion does not cascade to messages. TTL deletion is asynchronous and is not a strict deletion deadline. Do not enable intake before approving/configuring retention. Duplicate receipts do not extend retention. Old messages delivered late remain individually stored but do not alter the latest summary.

## Validation and rollout

Run `node --test scripts/test-whatsapp-inbox.mjs`, `node scripts/test-whatsapp-catalog.mjs`, `node scripts/test-whatsapp-sync.mjs`, and lint the changed JS/JSX files separately (the existing build ignores lint/type errors). Use a separate test Meta app/number, approved Firebase test environment and authorized test recipient; no production tokens in tests. Verify valid/invalid GET challenges, signed/unsigned POSTs, retries, unsupported media, pagination, revoked/disabled/non-admin users, and UI empty/error/loading states. Check the existing catalog scheduler still operates independently. No live Meta or Firestore writes are part of automated tests.

Deployment, hosting secrets, Firestore TTL and Meta subscription changes require separate user approval. Roll back intake by disabling `WHATSAPP_INBOX_ENABLED`; catalog reconciliation continues unchanged. Keep the callback enabled during an outage only when returning a retryable error is intended. Preserve the stored inbox for approved retention; do not silently delete customer messages during rollback.
