# Customer follow-up automation — phase 4

## Implemented locally

- Daily scheduled task checks with a durable lease, scan cursor and bounded work.
- Owner-only in-panel notification list, read marking and focused task links.
- Explicit browser notification opt-in via Firebase Cloud Messaging using existing Firebase libraries.
- Pause stale offer/silent-customer reminders after a new incoming message or permission withdrawal; missing linked source records also pause.
- Complete offer-linked tasks only when the actual ERP sale is confirmed/completed, matches sourceCommercialOfferId and is not cancelled. A sales draft is not completion. Explicit callback tasks are retained when the customer writes.
- Signed WhatsApp delivery statuses: sent, delivered, read, failed. Old events never regress a later state or extend the customer response window.

No job sends a customer WhatsApp message or requests an AI draft. Operator approval remains mandatory for all customer messages.

## Hobby schedule and capacity

The user confirmed Vercel Hobby and browser + in-panel notifications. vercel.json adds one CRM cron at `0 4 * * *` (04:00 UTC / 09:00 Kazakhstan). Hobby runs once per day with up to 59 minutes scheduling imprecision: expected local invocation is 09:00–09:59, not an exact 09:00 alarm. Minute/hour reminders require an independently configured higher-frequency scheduler or an appropriate hosting plan. No external scheduler or plan upgrade was created.

GET /api/jobs/crm-followups requires CRM_AUTOMATION_ENABLED=true and an exact Bearer CRON_SECRET of at least 32 characters. Normal user ID tokens cannot run the job. Vercel supplies CRON_SECRET to the cron request once configured. The runner scans at most 50 open tasks per leased page; the HTTP handler continues up to 20 pages within one shared 45-second budget, reserving time for storage finalization; it drains pending push batches even after the task scan is finished. A cursor resumes unfinished scans on the next invocation. The UI exposes last completion, errors and a remaining scan. If a queue exceeds daily bounded capacity or a job fails, the next Hobby invocation may be a day later. Monitor and change scheduling/capacity rather than promising immediate alarms.

Task rules are evaluated during these checks, not immediately by a database trigger. Pause/complete operations are audited and change task revision. Operators can review and reopen a paused task with a new date. Rescheduling/reopening creates a new notification cycle and records the current conversation baseline. Callback appointments are not cancelled merely because the customer sent another message.

## Notification safety and delivery

crm_notifications uses a deterministic ID for task + date + notification cycle; repeated/concurrent scans create one record. Alerts belong to assignedTo (fallback createdBy), and only that authenticated active admin can list/mark them read. No customer name, private note, phone or message body is included in browser payloads. Old notifications update their review/resolved reason as rules change; obsolete browser sends are skipped after re-reading task cycle/status and owner role. In-panel notification data is durable even if browser delivery is unavailable.

Browser push uses a separate worker at /firebase-messaging-sw.js with scope /crm-push/. It does not replace the existing offline /sw.js. Its public Firebase config is shared with the existing client app. Firebase compat scripts are pinned to the installed Firebase dependency version. Clicks always open the same-origin CRM; arbitrary payload links/text are ignored. The worker handles a data-only FCM message and creates a generic notification.

The operator must click “Tarayıcı bildirimini aç” and grant browser permission. CRM_BROWSER_PUSH_ENABLED=true, a valid public NEXT_PUBLIC_FIREBASE_VAPID_KEY, enabled FCM HTTP v1 API and the appropriate existing Firebase Admin credential permissions must be configured first. Generate/obtain the Web Push public VAPID key securely in Firebase Console; no private VAPID key belongs in the browser or chat. No credentials, cloud APIs or hosting flags were changed here.

crm_push_subscriptions stores opaque tokens server-side, keyed by token hash and bound to the current UID; no API lists raw tokens. It supports up to 10 active browsers/operator, expires registrations after 14 days, renews them on CRM visits without a new prompt and prunes expired slots. Explicit sign-out attempts server deletion, browser PushSubscription unsubscribe, worker unregister and Firebase token deletion. External auth sign-out also attempts local cleanup. Network cleanup can fail; payloads remain generic and server expiration/invalid-token cleanup provide a fallback. Browser/OS background restrictions, permission revocation and offline state can prevent delivery; in-panel tasks remain authoritative.

Push claims are made once before the provider call. Ambiguous outcomes are not blindly retried; a failed/unknown browser send does not change the task or customer-message state. Registering a browser can requeue up to five existing unread no-subscription alerts after server validation. FCM acceptance is not proof that the OS displayed the alert. Unknown/stuck sending outcomes require operational review, not automatic duplication.

## WhatsApp receipt correlation

The existing raw-body HMAC webhook verification, account/phone filtering and request bound remain in place. Recognized delivery events retain only message/recipient IDs, timestamp, status and numeric error code. Foreign-account/phone events are ignored. Receipt records are keyed by phone ID + Meta message ID. The accepted outgoing send transaction maps that receipt to the exact conversation/local message and applies an already-arrived receipt atomically. A later signed status updates only that exact verified mapping/recipient; it cannot search by phone/time and guess which unresolved request it belongs to.

Mapped signed receipts can resolve a pending message whose exact Meta ID is known. If an API timeout never returned a Meta ID, a new receipt alone cannot safely identify the local request; it stays orphaned and the original send remains locked until verified administrative investigation. No blind “unlock/retry” button is provided. A failed delivery is displayed separately from API acceptance, and does not automatically resend a customer message. Receipts do not change lastIncomingAt or the service window.

## Configuration, retention and rollout checks

New environment names are in docs/crm-runtime.env.example, disabled/empty by default. The schedule is a local deployment configuration only: it has not been registered in a live deployment. Run `node scripts/check-crm-readiness.mjs` for local environment presence/flags without printing secrets or contacting providers. This cannot confirm the Vercel environment, actual permission grants, FCM delivery or Meta approval.

Configure Firestore TTL separately for crm_notifications and whatsapp_delivery_receipts (expiresAt, 90 days), crm_push_subscriptions (14 days), and existing quota/inbox collections. Parents do not cascade-delete child events/messages. Task, audit and consent retention still need a deliberate policy; no production TTL or rules change was made. Default-deny Firestore rules protect all these server-only collections. Queries use built-in equality/document-ID indexes; no composite index deployment is introduced.

Before enabling in production: verify the full production build, authenticated admin/non-admin browser flows, an authorized test user's opt-in/sign-out/owner isolation, real FCM background/foreground delivery, one cron invocation with duplicate protection, task pause after reply and actual sale confirmation, and real signed sent/delivered/read events on an explicitly approved test message. Test rescheduling, missing sources, revoked consent and failed delivery. Existing automated tests mock all external services and do not write live records or send notifications/messages.

Local validation: npm run test:crm (57 tests), npm run lint:crm and a complete isolated production build (322 generated pages). Nine production HTTP smoke checks also passed locally. This does not imply real-device/provider or authenticated-browser acceptance. No deployment was performed.

Official references:
- https://firebase.google.com/docs/cloud-messaging/web/get-started
- https://firebase.google.com/docs/cloud-messaging/web/receive-messages
- https://firebase.google.com/docs/cloud-messaging/send/admin-sdk
- https://vercel.com/docs/cron-jobs/usage-and-pricing

## Latest local verification

57 automated tests passed, targeted ESLint passed and the complete isolated production build generated all 322 pages successfully. The repository's existing ignoreBuildErrors setting skipped TypeScript validation; changed JS/JSX files were linted separately. Next's temporary tsconfig/types-reference edits for the isolated output were removed afterward. No original build output, live cloud configuration or deployment is needed for these test artifacts.

The local configuration presence check found automation/browser push/inbox/sending/template flags off, no CRON_SECRET, no public VAPID key and no local WhatsApp sender/WABA/token/version settings. This describes only the PC environment; it does not establish the current hosting configuration or contradict a working live WhatsApp connection. Real-device notification opt-in, hosting runtime configuration and authenticated acceptance still remain rollout steps.

Production HTTP smoke checks also passed for nine local routes: CRM/WhatsApp pages, unauthenticated protected APIs, disabled job/webhook and the separate push worker. No authenticated browser or real provider delivery test was performed.
