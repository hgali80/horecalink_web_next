# WhatsApp inbox and reviewed replies

## Real-number connection: +7 700 444 69 11

The inbox now includes an admin-only connection check at `/api/admin/whatsapp/connection`.
It reports configuration presence and the latest stored incoming timestamp without exposing secrets.
The panel's **Meta bağlantısını kontrol et** button explicitly calls `?meta=1` to read the configured
phone, WABA phone membership and exact app subscription from Meta. It does not change Meta settings.
Set `WHATSAPP_APP_ID` in addition to the existing messaging token and Graph API version to use this check.
The token needs WhatsApp account management read access. Unknown/paginated results are not treated as missing subscriptions.
This check does not verify the app-level callback, the `messages` field subscription, phone-level overrides,
phone registration/coexistence or end-to-end delivery. A stored test conversation is not proof of a live connection.

Operator rollout, using hosting secrets (never paste credentials into chat):

1. In Meta, select the actual business number **+7 700 444 69 11**. Complete its supported
   registration/coexistence process if needed; this code does not register, migrate or disconnect a phone.
2. Set `WHATSAPP_INBOX_ENABLED=true`, `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_WABA_ID`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_ACCESS_TOKEN` and the supported `WHATSAPP_GRAPH_API_VERSION` in hosting secrets.
   Use the real business phone's ID, not the historical test sender ID. Preserve Firebase Admin secrets.
   Retention/TTL requirements below still apply.
3. Deploy the application. In Meta configure the HTTPS callback
   `https://horecalink.kz/api/webhooks/whatsapp` with the same verification token, then subscribe to `messages`.
   Confirm any existing app/WABA/phone callback overrides point to the intended callback.
4. With these environment variables supplied securely, run `node scripts/setup-whatsapp-inbox.mjs`
   for read-only checks. If the exact app is absent from the WABA subscription, run with `--subscribe`.
   This verifies the real number, WABA membership and token app identity before creating the missing
   subscription, then reads back the result. Existing subscriptions/overrides are never overwritten.
   It does not configure the app-level callback. Do not run a local development process with production secrets.
5. Send a new message **from another phone to +7 700 444 69 11** and refresh the panel.
   Hosting logs emit only safe `whatsapp_webhook` outcomes: `persisted` (including duplicate retries),
   `incoming_filtered` with account/phone match booleans, `no_incoming_messages`, or `storage_failed`.
   No webhook request means check Meta delivery/subscriptions; `incoming_filtered` means check IDs;
   `storage_failed` means check Firebase availability/credentials. No message bodies or secrets are logged.

Validation: `node --test scripts/test-whatsapp-connection.mjs scripts/test-whatsapp-inbox.mjs scripts/test-whatsapp-replies.mjs`.
Provider calls in tests are mocked. The setup command does not send WhatsApp messages.
Meta reference: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api

Panel: `/admin/whatsapp`, linked from `/satissitok/admin`. Only active `admin` and `super_admin` users can read inbox APIs. Every request verifies the Firebase ID token with revocation checks and reads the current user record. The client role check is navigation only; server checks protect the data.

Incoming messages are listed alongside manually approved outgoing replies. Draft generation and sending are separate, opt-in server features. Catalog services, credentials, product fields, imports and reconciliation are independent and unchanged.

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


## Reviewed replies (disabled by default)

The operator can write manually or request a Russian, Kazakh, Turkish or English draft. Every send requires reviewing the editable final text and checking the recipient confirmation. Editing text clears that confirmation. Nothing is sent from the webhook or AI response. Only active admins/super-admins can call the authenticated reply POST endpoint.

Configure only server secrets (never NEXT_PUBLIC):
- `WHATSAPP_DRAFTS_ENABLED=true`, `OPENAI_API_KEY`, `OPENAI_MODEL`: select an account-available Responses model supporting strict JSON-schema text output. No model default is assumed.
- `WHATSAPP_SEND_ENABLED=true`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_API_VERSION` (e.g. `v26.0` after checking Meta support). Use the intended Cloud API messaging credential, never the catalog credential. Existing `WHATSAPP_PHONE_NUMBER_ID` determines the sender.

Deploy the four-language privacy disclosure before enabling drafts. Last 12 messages, at most 1,500 characters each, are sent to OpenAI on operator request; phone/profile metadata is excluded, but message text may contain personal information. `store:false` disables Responses application storage; it does not promise zero retention by the provider. Configure provider access/billing separately. No verified product facts are supplied: operators must check prices, stock and claims. Untrusted customer text is data and there are no model tools. Draft requests are limited to one per 15 seconds and 30 per hour per operator, including failed attempts. Configure TTL for `whatsapp_reply_limits` as well.

Sending is text-only, within 24 hours of the latest incoming message. Server obtains the recipient from the conversation, verifies the configured phone, checks the operator's reviewed message version and atomically claims a durable request ID before calling Meta. Retries of that same ID return its recorded state without another upstream call. The approved text, operator UID and time are stored with the outgoing message. Editing after a failed transport attempt starts a different request, but an unresolved prior claim blocks any new send for that conversation.

`accepted` means Meta accepted the request, NOT delivered/read. Delivery receipt processing is not included. Timeout, malformed response, 5xx or crash after claim can leave `unknown`/`sending`; these lock further sends. Check Meta/WhatsApp and the durable record before a deliberate administrative reconciliation of `pendingSendId`; never clear it blindly or retry automatically. A definite JSON 4xx rejection is recorded as `rejected`. If Meta accepted but the final database write failed, the durable claim still blocks a repeat. Existing incoming webhook logic ignores status-only events. Outgoing records share message TTL. No raw upstream errors or secrets are exposed.

Validate with `node --test scripts/test-whatsapp-replies.mjs scripts/test-whatsapp-inbox.mjs`, catalog/sync regression scripts, targeted ESLint and production build. Tests use mocked providers and storage, never live sends or paid API calls. Before rollout, test with the existing test number and explicitly reviewed content. Real-number migration/coexistence is a separate setup; this code does not migrate or register phone numbers. Deploy remains the owner's action.

References: https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses and https://developers.openai.com/api/docs/guides/your-data


### Sending rejection diagnostics
Definite Meta 4xx rejections now store and display only the numeric HTTP status, Meta error code and subcode. Provider message/details are neither logged nor stored, because they may expose tokens or customer information. The same request ID returns the recorded result without resending. After a definite rejection the client releases its request ID so a later explicitly approved send can make a new attempt after configuration is corrected. Unknown outcomes remain locked. Historical rejected records cannot recover discarded provider codes; one newly approved attempt after deployment is required for diagnosis.


### Verified Meta test-recipient alias
An operator-run Graph Explorer POST returned `contacts.input=787023940182` and `contacts.wa_id=77023940182`, and the text arrived on the operator phone. This is a verified test-only routing alias, not a general Kazakhstan normalization rule.

Optional server Config variable `WHATSAPP_TEST_RECIPIENT_MAP` accepts a JSON object of explicitly verified canonical-ID to API-input pairs. For this test use `{"77023940182":"787023940182"}`. It is applied ONLY when the conversation phone-number ID is the known Meta test sender `1298404383366536`; all business sender IDs and unmatched contacts retain canonical routing. Absence disables aliases. Never populate from client requests or guess aliases from phone prefixes. Malformed config fails closed for the test sender.

Messages GET exposes the resolved destination to the authorized operator; the confirmation shows the canonical recipient plus the Meta test mapping. Send requires that exact destination to be reviewed and rechecks it in the transaction, rejecting stale configurations. Canonical IDs, inbound records and conversation hashes remain unchanged. Outgoing audit records include the actual API recipient. If Meta returns a different canonical `wa_id`, the outcome remains unknown/locked; no fallback or automatic retry is performed. Remove the variable when retiring the test setup. Real business-number registration/coexistence remains a separate task. Deploy and one explicitly approved test send are still required; automated tests do not use live credentials.
