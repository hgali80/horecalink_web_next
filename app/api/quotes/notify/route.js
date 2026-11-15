import { NextResponse } from "next/server";
import { getMessaging } from "firebase-admin/messaging";
import { getAdminServices } from "@/app/lib/server/firebaseAdmin";

const MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(request) {
  let claimedQuoteRef = null;
  let notificationClaimed = false;
  try {
    const body = await request.json();
    const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
    if (!/^[A-Za-z0-9_-]{10,128}$/.test(requestId)) {
      return NextResponse.json({ error: "Talep kimliği geçersiz." }, { status: 400 });
    }

    const { adminApp, adminDb } = getAdminServices();
    const quoteRef = adminDb.collection("quote_requests").doc(requestId);
    claimedQuoteRef = quoteRef;
    const quoteSnapshot = await quoteRef.get();
    if (!quoteSnapshot.exists) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });

    const quote = quoteSnapshot.data();
    const createdAt = quote.createdAt?.toMillis?.() ?? 0;
    if (!createdAt || Date.now() - createdAt > MAX_AGE_MS || Date.now() < createdAt - 60_000) {
      return NextResponse.json({ error: "Talep bildirim süresini geçirdi." }, { status: 409 });
    }

    const claimed = await adminDb.runTransaction(async (transaction) => {
      const current = await transaction.get(quoteRef);
      if (!current.exists || current.data().adminPushNotification) return false;
      transaction.update(quoteRef, {
        adminPushNotification: { state: "sending", claimedAt: new Date() },
      });
      return true;
    });
    notificationClaimed = claimed;
    if (!claimed) return NextResponse.json({ sent: false, duplicate: true });

    const adminUsers = await adminDb.collection("users")
      .where("role", "in", ["admin", "super_admin"])
      .get();
    const recipients = adminUsers.docs
      .filter((doc) => doc.data().isActive !== false)
      .flatMap((doc) => {
        const data = doc.data();
        const tokens = [data.deviceToken, ...(Array.isArray(data.deviceTokens) ? data.deviceTokens : [])];
        return [...new Set(tokens.filter((token) => typeof token === "string" && token.trim()))]
          .map((token) => ({ token, userRef: doc.ref }));
      });

    if (!recipients.length) {
      await quoteRef.update({ "adminPushNotification.state": "no_token", "adminPushNotification.processedAt": new Date() });
      return NextResponse.json({ sent: false, reason: "no_token" });
    }

    const customer = quote.customer || {};
    const customerName = String(customer.companyName || customer.fullName || "Yeni müşteri").slice(0, 100);
    const messaging = getMessaging(adminApp);
    const result = await messaging.sendEachForMulticast({
      tokens: recipients.map((recipient) => recipient.token),
      notification: {
        title: "Yeni fiyat teklifi talebi",
        body: `${customerName} web sitesinden teklif talebi gönderdi.`,
      },
      data: { type: "quote_request", requestId, quoteRequestId: requestId },
      android: {
        priority: "high",
        notification: {
          channelId: "horecalink_admin_alerts_v2",
          sound: "message",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    });

    await quoteRef.update({
      "adminPushNotification.state": result.successCount ? "sent" : "failed",
      "adminPushNotification.successCount": result.successCount,
      "adminPushNotification.failureCount": result.failureCount,
      "adminPushNotification.processedAt": new Date(),
    });
    return NextResponse.json({ sent: result.successCount > 0, successCount: result.successCount, failureCount: result.failureCount });
  } catch (error) {
    console.error("Quote request push notification failed:", error);
    if (notificationClaimed && claimedQuoteRef) {
      await claimedQuoteRef.update({
        "adminPushNotification.state": "failed",
        "adminPushNotification.processedAt": new Date(),
      }).catch(() => {});
    }
    return NextResponse.json({ error: "Bildirim gönderilemedi." }, { status: 500 });
  }
}
