# Follow-up drafting, consent and approved templates — phase 3

## Operator workflow

From Customer Follow-ups, choose **Takip mesajı hazırla** on a task linked to a WhatsApp conversation. The conversation opens with a task panel. Record the actual customer permission (or withdrawal) and its source, using the explicit confirmation. Permission must not be inferred from a phone number, AI output or the mere existence of a task.

Use **Takip mesajı öner** for a reviewable draft. Within the service window, review/edit and explicitly send using the existing composer. Outside it, select an approved text template, fill the positional fields, inspect the rendered text, and confirm the exact recipient before sending. AI drafts never become template text or template parameters automatically.

The panel warns if a customer has messaged since task creation. The operator must inspect the latest conversation. A task kind is planning intent; it is not evidence an offer was sent or the customer ignored it. Sending does not close the sales opportunity or task. Accepted sends update lastFollowupSentAt/message ID and task revision; a second follow-up on the same task is blocked for 24 hours. The operator sets the next task date manually.

## AI boundary

Uses the existing configured OpenAI Responses model, server secret, strict reply JSON schema, store:false, per-operator quota and 12-message bounded context. The additional AI context contains only task kind and the bounded current offer number when linked. CRM task title, notes, contact fields, consent evidence, internal IDs and unverified offer amounts are excluded. Original customer message text can still contain personal information, as disclosed in the existing draft flow. No model tools or automatic sending are added. Task state and revision are checked before and after generation; incoming conversation revision is also rechecked.

## Storage and authorization

All new routes use existing revoked-token/active-admin checks and private, no-store responses. crm_contact_preferences/{conversationId} stores follow-up permission status, source, scope, revision, operator and timestamp. Its events subcollection retains changes. Existing default-deny Firestore rules deny client access; no rules deployment is needed. Permission is scoped to the exact conversation identity and is not automatically merged across phone numbers or ERP records. Revocation immediately blocks subsequent follow-up claims, including approved templates. Ordinary service replies remain a separate existing action.

POST /api/admin/whatsapp/conversations/{id}/followup handles explicit consent updates and reviewed template sends. GET returns bounded task/permission state for that exact conversation; private notes and evidence are excluded. Consent changes use optimistic concurrency. Template and text follow-up sends validate active task, revision, current permission and cooldown in the durable claim, then recheck before the provider message request. Approved send audit links back to the task. Parent deletion does not cascade; define CRM consent/audit retention before rollout separately from inbox TTL.

## Templates and configuration

GET /api/admin/whatsapp/templates reads the configured WABA's message_templates edge only when requested. It uses the existing messaging credential and may need whatsapp_business_management read permission. Fixed graph.facebook.com endpoints, bounded cursors and timeouts are used; provider-supplied next URLs are never followed. Only APPROVED MARKETING/UTILITY text templates are offered. Supported: a body with up to eight sequential positional text variables, optional static TEXT header and footer. Named variables, media headers, buttons, authentication templates and other components are excluded. Pages are loaded explicitly; an empty supported page does not mean the account has no other templates.

Before a new send, the server re-reads templates by the reviewed name under the configured WABA, matches exact template ID/language and checks its normalized fingerprint. Parameters are bounded and the server recomputes the exact reviewed preview. Lookup is capped at the provider page of 100 variants; unavailable/unreturned variants fail closed. AI does not choose a Meta category or claim Meta approval. No template creation or approval submission is performed.

Sending is disabled until both WHATSAPP_SEND_ENABLED=true and WHATSAPP_TEMPLATE_SEND_ENABLED=true are configured on the server, along with the existing token, phone ID, WABA ID and Graph version. No secrets or flags were changed by this implementation. Meta account/template approval, supported languages, current permissions, recipient consent and applicable pricing need verification before authorized production testing. No template is hard-coded as already approved.

## Delivery and retry semantics

Template sends share the existing conversation pendingSendId lock with text/image replies. Durable request IDs and content fingerprints prevent concurrent duplicate sends. Retries return the original stored result even after task/permission state changes; they do not send again. Rejected validation before the provider call releases the claim. Timeout, malformed response, crash or persistence failure after starting the message request remains unknown/sending and blocks new sends. Numeric Meta rejection diagnostics are exposed without raw error text. Accepted means Meta acceptance, not delivery/read; receipt processing and administrative reconciliation remain phase 4.

## Validation

Run node --test scripts/test-whatsapp-followups.mjs scripts/test-whatsapp-product-card.mjs scripts/test-whatsapp-replies.mjs scripts/test-whatsapp-inbox.mjs scripts/test-crm-followups.mjs scripts/test-crm-followups-api.mjs plus targeted ESLint. Tests mock database/Meta/OpenAI and cover permission withdrawal, stale task/draft, preview tampering, expired service window template send, simultaneous duplicates, same-task cooldown, provider ambiguity, and private-note exclusion. No live database writes, messages or paid AI calls are part of validation.

Next's compile mode is checked with isolated output under .local-backups/crm-build-validation, including inherited worker config. It is not a completed static-generation build, an authenticated browser acceptance test or a live Meta test. Phase 4 still includes off-panel notifications, background due-task handling, delivery receipts and stop/reschedule rules after customer reply or sale. No deployment has been performed.

Official references:
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://whatsappbusiness.com/policy/
- https://www.postman.com/meta/whatsapp-business-platform/request/o65u5m5/send-message-template-text

Phase 4 is now implemented locally; see docs/crm-automation.md. Hosting flags, daily Hobby cron activation, FCM setup, device acceptance and live rollout remain separate.
