# Product sharing — phase 2

The WhatsApp reply composer offers text, product link, image card, and image with product link. Product cards are generated from the selected active web-published product, not from a screenshot or AI-generated facts. The operator selects the product/language, optionally includes the website list price (off by default), explicitly prepares the preview, reviews the JPEG and exact final caption, and confirms the recipient before sending. Specification text is taken from the localized product field when available; it is not translated automatically. A localized name falls back to the recorded Russian/default name.

Preview endpoint: authenticated POST `/api/admin/whatsapp/products/card`. No Meta upload or message occurs during preview. Rendering is limited to 120 attempts/operator/hour and one every two seconds across tabs. The `whatsapp_card_limits` documents have an expiresAt field; configure TTL before rollout to clean inactive quota records. No Firestore rules deployment is required because browser access is denied by existing fallback rules.

The renderer accepts only the fixed Firebase product-images bucket URL built from persisted image filenames. Redirects are rejected. JPEG/PNG/WebP input is capped at 5 MiB and 40 million decoded pixels. Product fields are escaped before SVG rendering. Sharp creates an opaque 1080 × 1240 JPEG. All four supported languages use the same layout; product text is bounded/wrapped. No stock, delivery or personalized prices are inferred.

Sending uses the existing `/reply` endpoint and existing server-only WhatsApp configuration. No new provider credential or automatic feature flag is added. Image sending still requires WHATSAPP_SEND_ENABLED and the configured messaging token/phone/API version, plus explicit operator approval. The server checks product facts in the durable send transaction, regenerates the exact preview, rejects changed picture bytes, uploads JPEG with multipart `/media`, and sends an image by media ID. Image captions are capped at 1024 Unicode characters. Image + link is a single image message with a link in its caption.

Recipient, incoming revision, phone and the 24-hour window are verified before claim and again after media preparation. Canonical/test-alias handling remains unchanged. Duplicate request IDs return their recorded state. Changed content/card/options with the same ID are rejected. Rendering/upload failures cannot have sent a message, are recorded as rejected, and release the pending claim. Once the message request starts, timeout/invalid upstream response remains unknown and locks new sending. No automatic resend occurs. Accepted still means provider acceptance, not delivery/read. The audit stores card facts, fingerprints and media ID, not a new public customer-specific image URL. Media may remain on Meta even if a later send fails; lifecycle cleanup is not automated in this phase. Historical messages display card name and caption; original image re-download/thumbnail history is not implemented.

Validation: `node --test scripts/test-whatsapp-product-card.mjs scripts/test-whatsapp-replies.mjs scripts/test-whatsapp-inbox.mjs scripts/test-crm-followups.mjs scripts/test-crm-followups-api.mjs`. Image/route tests use synthetic product facts and mocked network/storage, including actual Sharp rendering. No live Meta sends, paid AI requests or production database writes are involved. Targeted ESLint is run separately. Production acceptance still requires previewing a real product and an explicitly approved send to an authorized test recipient after deployment. Cloud rendering fonts and Meta media permissions must be verified there.

Official upload/message reference: https://whatsappbusiness.com/blog/media-messages-via-app/

## Remaining roadmap

Phase 3 is implemented locally; see docs/whatsapp-followups.md for follow-up-specific AI drafts, recorded permission and approved text-template support. Live approval/configuration/testing remain separate rollout steps.
Phase 4: background due-task processing, chosen off-panel notification channel, delivery events, stop/reschedule rules after a customer reply or sale, monitoring and safe reconciliation.

No deployment, live send, secrets change, template registration or background schedule was performed during this implementation.

Phase 4 is now implemented locally; see docs/crm-automation.md. Hosting flags, daily Hobby cron activation, FCM setup, device acceptance and live rollout remain separate.
