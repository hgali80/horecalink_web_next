const admin = require("firebase-admin");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKeyFromDoc(doc) {
  const d =
    tsToDate(doc.documentDate) ||
    tsToDate(doc.invoiceDate) ||
    tsToDate(doc.createdAt) ||
    new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return { dayKey: `${y}-${m}-${day}`, monthKey: `${y}-${m}` };
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function cleanKey(k) {
  return String(k || "unknown").replace(/[./#[\]]/g, "_");
}

function saleContribution(doc) {
  // Sadece resmi + completed rapora girsin
  if (doc.saleType !== "official") return null;
  if (doc.status !== "completed") return null;

  const net = round2(doc.netTotal);
  const vat = round2(doc.vatTotal);
  const gross = round2(doc.grossTotal);

  const platform = cleanKey(doc.saleChannel || doc.platformId || "other");

  // vatRate null olabilir → 0’a çekiyoruz
  const vr = doc.vatRate == null ? 0 : Number(doc.vatRate || 0);
  const vatRateKey = cleanKey(vr);

  return { net, vat, gross, platform, vatRateKey };
}

function purchaseContribution(doc) {
  if (doc.purchaseType !== "official") return null;
  if (doc.status !== "completed") return null;

  // purchaseService sonrası bunlar garanti
  const net = round2(doc.netTotal ?? doc.totals?.net);
  const vat = round2(doc.vatTotal ?? doc.totals?.tax ?? doc.totals?.vat);
  const gross = round2(doc.grossTotal ?? doc.totals?.gross);

  // Purchase tarafında platform yok; istersen supplierRef üzerinden gruplayabiliriz
  const vatRateKey = cleanKey(Number(doc.taxRate || 0));

  return { net, vat, gross, vatRateKey };
}

async function applyDelta({ db, scopeDocRef, delta }) {
  const inc = admin.firestore.FieldValue.increment;

  // core
  const patch = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // sales
  if (delta.sales) {
    patch["sales.net"] = inc(delta.sales.net);
    patch["sales.vat"] = inc(delta.sales.vat);
    patch["sales.gross"] = inc(delta.sales.gross);
    patch["sales.count"] = inc(delta.sales.count);

    patch["outputVat"] = inc(delta.sales.vat);

    // breakdowns
    if (delta.sales.platform) {
      patch[`byPlatform.${delta.sales.platform}.outVat`] = inc(delta.sales.vat);
      patch[`byPlatform.${delta.sales.platform}.outGross`] = inc(delta.sales.gross);
    }
    if (delta.sales.vatRateKey) {
      patch[`byVatRate.${delta.sales.vatRateKey}.outVat`] = inc(delta.sales.vat);
      patch[`byVatRate.${delta.sales.vatRateKey}.outNet`] = inc(delta.sales.net);
    }
  }

  // purchases
  if (delta.purchases) {
    patch["purchases.net"] = inc(delta.purchases.net);
    patch["purchases.vat"] = inc(delta.purchases.vat);
    patch["purchases.gross"] = inc(delta.purchases.gross);
    patch["purchases.count"] = inc(delta.purchases.count);

    patch["inputVat"] = inc(delta.purchases.vat);

    if (delta.purchases.vatRateKey) {
      patch[`byVatRate.${delta.purchases.vatRateKey}.inVat`] = inc(delta.purchases.vat);
      patch[`byVatRate.${delta.purchases.vatRateKey}.inNet`] = inc(delta.purchases.net);
    }
  }

  // payableVat = output - input → burada ayrı ayrı increment ile tutuyoruz
  // (outputVat ve inputVat zaten increment. payable için net delta yazıyoruz)
  patch["payableVat"] = inc(delta.payableVat);

  await scopeDocRef.set(
    {
      sales: { net: 0, vat: 0, gross: 0, count: 0 },
      purchases: { net: 0, vat: 0, gross: 0, count: 0 },
      outputVat: 0,
      inputVat: 0,
      payableVat: 0,
      byPlatform: {},
      byVatRate: {},
      ...patch,
    },
    { merge: true }
  );
}

function deltaFromBeforeAfter(beforeDoc, afterDoc, type) {
  // type: "sale" | "purchase"
  const before = beforeDoc ? (type === "sale" ? saleContribution(beforeDoc) : purchaseContribution(beforeDoc)) : null;
  const after = afterDoc ? (type === "sale" ? saleContribution(afterDoc) : purchaseContribution(afterDoc)) : null;

  // katkı yoksa
  if (!before && !after) return null;

  // net delta = after - before (yoksa 0)
  const b = before || { net: 0, vat: 0, gross: 0, platform: null, vatRateKey: null };
  const a = after || { net: 0, vat: 0, gross: 0, platform: null, vatRateKey: null };

  if (type === "sale") {
    const d = {
      sales: {
        net: a.net - b.net,
        vat: a.vat - b.vat,
        gross: a.gross - b.gross,
        count: (after ? 1 : 0) - (before ? 1 : 0),
        platform: a.platform || b.platform, // breakdown için (basit yaklaşım)
        vatRateKey: a.vatRateKey || b.vatRateKey,
      },
      purchases: null,
      payableVat: (a.vat - b.vat),
    };
    return d;
  }

  // purchase
  const d = {
    sales: null,
    purchases: {
      net: a.net - b.net,
      vat: a.vat - b.vat,
      gross: a.gross - b.gross,
      count: (after ? 1 : 0) - (before ? 1 : 0),
      vatRateKey: a.vatRateKey || b.vatRateKey,
    },
    payableVat: 0 - (a.vat - b.vat), // inputVat artarsa payable düşer
  };
  return d;
}

exports.onSaleWriteUpdateVat = async (change, context) => {
  const beforeDoc = change.before.exists ? change.before.data() : null;
  const afterDoc = change.after.exists ? change.after.data() : null;

  // tarih anahtarını after > before’dan al
  const baseForKey = afterDoc || beforeDoc;
  if (!baseForKey) return;

  const { dayKey, monthKey } = dateKeyFromDoc(baseForKey);
  const delta = deltaFromBeforeAfter(beforeDoc, afterDoc, "sale");
  if (!delta) return;

  const db = admin.firestore();
  await applyDelta({
    db,
    scopeDocRef: db.collection("vat_reports_daily").doc(dayKey),
    delta,
  });
  await applyDelta({
    db,
    scopeDocRef: db.collection("vat_reports_monthly").doc(monthKey),
    delta,
  });
};

exports.onPurchaseWriteUpdateVat = async (change, context) => {
  const beforeDoc = change.before.exists ? change.before.data() : null;
  const afterDoc = change.after.exists ? change.after.data() : null;

  const baseForKey = afterDoc || beforeDoc;
  if (!baseForKey) return;

  const { dayKey, monthKey } = dateKeyFromDoc(baseForKey);
  const delta = deltaFromBeforeAfter(beforeDoc, afterDoc, "purchase");
  if (!delta) return;

  const db = admin.firestore();
  await applyDelta({
    db,
    scopeDocRef: db.collection("vat_reports_daily").doc(dayKey),
    delta,
  });
  await applyDelta({
    db,
    scopeDocRef: db.collection("vat_reports_monthly").doc(monthKey),
    delta,
  });
};