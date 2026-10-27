# Customer follow-ups — phase 1

Route: `/satissitok/admin/crm`. Entry points: admin dashboard, saved commercial offer, ERP customer detail, selected WhatsApp conversation.

This phase stores dated tasks with explicit optional customer/offer/conversation references. Links are checked server-side; no phone-based automatic merge occurs. Each task is assigned to its creator; all active admin/super_admin operators share the queue. Other staff roles cannot access the API. Revoked tokens are rejected using the existing inbox authorization helper.

`crm_followups` documents and their `events` subcollection are accessed only through authenticated server APIs. Existing default-deny Firestore rules block browser reads/writes; no rules deployment or composite index is required. Request bodies are bounded at 16 KiB. Mutations use transactions and revisions; create retries reuse the same request ID. The browser clears records on list failure and remounts on account change.

Task time inputs/display use Asia/Qyzylorda (UTC+5), storage uses UTC. Past calendar days are marked overdue; the current Kazakhstan day is Today. Complete/cancel closes a task; reschedule/reopen takes an explicit date. No operation sends messages, invokes AI, or marks a commercial offer sent. Audit events retain action, operator, prior/new due date and status.

Queues are paginated in stable document-ID order (50 tasks per request), sorted by date within the loaded set. Counters/search cover loaded records only; the UI explicitly labels this and provides Load more. Refresh fetches the first page. No automatic polling or background scheduler is installed in this phase.

Not yet included: automatic follow-up creation on outbound offer, automatic cancellation after customer reply or sale, CRM master customer deduplication, reassignment, messaging templates, media sending, delivery receipts, email/push alerts or scheduled external notifications. Operators manually complete or cancel a task after reviewing the conversation. Customer/offer/conversation references are explicit independent links; the operator confirms they belong together. Source records are not modified.

No live database/provider calls are needed for validation. Run `node --test scripts/test-crm-followups.mjs` and targeted ESLint. Production acceptance requires an authorized test admin to create a task, follow its source links, reschedule it, complete it and reopen it; verify another role is denied and two tabs cannot overwrite the same revision. No live acceptance task has been created by this implementation.

These tasks have no TTL. Agree CRM task/audit retention before rollout, separately from the inbox message TTL; expired/deleted source records can leave historical links unavailable. Deploy and production rollout are separate owner-approved steps.
