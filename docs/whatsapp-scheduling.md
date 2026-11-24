# WhatsApp scheduled messages

The admin inbox stores reviewed plans in `whatsapp_scheduled_messages` with Firestore `Timestamp` values (UTC). The browser displays Asia/Almaty time (UTC+5). The one-minute Google Cloud Scheduler job calls the authenticated app endpoint; Vercel's existing daily CRM cron is not used for message delivery.

## Hosting configuration

Set these server-only variables in the app hosting environment:

- `WHATSAPP_SCHEDULER_SECRET`: generate a unique random secret with at least 32 bytes. Keep it separate from the Meta access token and Firebase credentials.
- Existing `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.
- Existing `WHATSAPP_SEND_ENABLED=true`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_GRAPH_API_VERSION`.
- For plans outside the 24-hour service window, also configure `WHATSAPP_TEMPLATE_SEND_ENABLED=true`, `WHATSAPP_WABA_ID` and the existing `crm_contact_preferences` grant record for the conversation. A currently approved Meta template is re-read before sending.

Deploy the application and Firestore indexes, then create a Cloud Scheduler HTTP job in the same Google Cloud project as Firestore. Run it every minute in UTC. Point it at `https://horecalink.kz/api/jobs/whatsapp-scheduled`, method POST, with header `X-WhatsApp-Scheduler-Secret` set to the same secret and JSON body `{}`. Example (provide the secret through a protected shell variable; do not save it in source control):

```powershell
gcloud scheduler jobs create http whatsapp-scheduled-send `
  --schedule="* * * * *" --time-zone="UTC" `
  --uri="https://horecalink.kz/api/jobs/whatsapp-scheduled" `
  --http-method=POST --update-headers="X-WhatsApp-Scheduler-Secret=$env:WHATSAPP_SCHEDULER_SECRET,Content-Type=application/json" `
  --message-body="{}" --location=YOUR_CLOUD_SCHEDULER_REGION
```

Grant the Scheduler service the permission needed to invoke the hosting URL if the host protects it. Keep the endpoint secret in Google Secret Manager or inject it from a protected deployment environment; do not paste it into a command that is stored in shell history. Confirm the scheduler execution log and a non-delivery dry-run in a dedicated staging environment before enabling real send credentials. This project change does not create the Cloud Scheduler job, deploy indexes, set secrets, or send a real message.

## Message behavior

Creation rechecks the latest incoming message revision, recipient, active send lock, and 24-hour window. Free text is rejected if the chosen Almaty time is outside that window; the operator must select an approved template and review its rendered preview. Template permission, approval and revision are checked again immediately before the Meta request. Message text is never rewritten automatically.

New incoming messages and new outgoing panel sends cancel still-pending plans transactionally with the reason `Müşteri mesaj gönderdi` or `Siz mesaj gönderdiniz`. Signed `smb_message_echoes` webhook events are also handled as outgoing activity. Duplicate message IDs are idempotent and old events timestamped before plan creation do not cancel it. The scheduler claims each plan and places the conversation send lock in a Firestore transaction, then checks the conversation and permission again before submitting to Meta. A second scheduler invocation cannot submit a claimed plan. Unknown network/provider outcomes are marked `Gönderim doğrulanamadı` and never retried automatically. `accepted` means Meta accepted the API request; `delivered`, `read`, and `failed` come from WhatsApp status webhooks.

## Phone app echo coverage

The webhook normalizer already accepts signed `smb_message_echoes` events and the scheduled-message path treats a new echo as operator activity. This does not prove that a particular WhatsApp Business phone is connected in Coexistence or that Meta currently delivers the `smb_message_echoes` field to this app. Before relying on phone-originated cancellation, verify the business number's Coexistence eligibility and Meta webhook field subscription, then run a controlled staging check and confirm the event appears in the inbox. The existing connection check verifies WABA app subscription and phone membership only; it does not verify app-level echo field subscriptions or Coexistence. No live connection settings were changed as part of this code task.

## Indexes and validation

`firebase.json` points to `firestore.indexes.json`, including the due-queue and outgoing-message indexes. Deploy those indexes before enabling the scheduler. Use `npm run test:crm`, targeted ESLint for the scheduled files, and `npm run build` before rollout. Tests must use mocked Firestore and Meta; never use production credentials or a real recipient.
