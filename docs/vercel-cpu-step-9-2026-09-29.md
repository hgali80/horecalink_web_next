# Vercel CPU optimization — step 9

Date: 2026-09-29

## Goal

Reduce visitor analytics requests and duplicate writes without losing valid page-view data.

## Changes

- The browser now collects page views for up to 10 seconds and sends at most 20 events in one request.
- Pending events are sent with `sendBeacon` when the page closes, so short visits are still recorded.
- Repeated views of the same path within 30 seconds are tracked in a recent-path map. This also blocks duplicate A-B-A events and React development remounts.
- Every new page view has a stable event ID and its original occurrence time.
- The API accepts both the new event batches and the previous single-event payload.
- Admin Firestore writes use deterministic document IDs. A retry overwrites the same analytics document instead of creating a duplicate.
- The client Firebase fallback now runs only when Firebase Admin environment variables are missing. Real Admin or Firestore errors are returned instead of repeating the write through a second SDK.
- The fallback uses one Firestore batch commit rather than separate writes.
- Requests are limited to 20 events and 32 KB. Invalid and excluded events are ignored safely.

## Sampling

No sampling is used. Every valid page view remains in the batch, so page and product view counts keep their existing detail. The number of Firestore documents stays approximately the same; the savings come from fewer Vercel function invocations, fewer network round trips and idempotent retries.

## Expected effect

A visitor who opens several pages within a 10-second window now normally produces one Vercel analytics request instead of one request per page. Single-page visits still produce one request. The exact reduction therefore depends on browsing speed and pages per session.

## Validation

- Targeted ESLint: passed.
- Production build: passed; 316 static pages/routes generated.
- Empty or invalid analytics event: HTTP 200 with `accepted: 0` and no database write.
- Malformed JSON: HTTP 400.
- More than 20 events in one request: HTTP 413.
