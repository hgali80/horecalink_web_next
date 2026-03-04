// app/satissitok/services/plReportService.js
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/firebase";

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

function toStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function toEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function dateKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO week key: YYYY-Www
function weekKey(d) {
  const x = new Date(d);
  const t = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function monthKey(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function yearKey(d) {
  return String(new Date(d).getFullYear());
}

function pickPeriodKey(d, period) {
  if (period === "day") return dateKey(d);
  if (period === "week") return weekKey(d);
  if (period === "year") return yearKey(d);
  return monthKey(d); // default month
}

function tsToDate(v) {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * P&L report
 * period: day | week | month | year
 * dateField: "documentDate" önerilir (muhasebe dönemi için)
 */
export async function loadPLReport({
  fromISO,
  toISO,
  period = "month",
  dateField = "documentDate",
}) {
  if (!fromISO || !toISO) throw new Error("fromISO ve toISO zorunlu");

  const start = toStartOfDay(new Date(fromISO));
  const end = toEndOfDay(new Date(toISO));

  const startTS = Timestamp.fromDate(start);
  const endTS = Timestamp.fromDate(end);

  // -------------------------
  // SALES (completed)
  // -------------------------
  const salesQ = query(
    collection(db, "sales"),
    where("status", "==", "completed"),
    where(dateField, ">=", startTS),
    where(dateField, "<=", endTS)
  );

  // RETURNS (returned)
  // iade tarihini period’a dahil etmek için returnedAt kullanmak daha doğru,
  // ama sende "documentDate" da var. Burada returnedAt varsa onu baz alıyoruz.
  const returnsQ = query(
    collection(db, "sales"),
    where("status", "==", "returned"),
    where("returnedAt", ">=", startTS),
    where("returnedAt", "<=", endTS)
  );

  // -------------------------
  // PURCHASES (completed)
  // -------------------------
  const purchasesQ = query(
    collection(db, "purchases"),
    where("status", "==", "completed"),
    where(dateField, ">=", startTS),
    where(dateField, "<=", endTS)
  );

  const [salesSnap, returnsSnap, purchasesSnap] = await Promise.all([
    getDocs(salesQ),
    getDocs(returnsQ),
    getDocs(purchasesQ),
  ]);

  // Aggregators
  const byPeriod = {}; // key -> metrics
  const ensure = (k) => {
    if (!byPeriod[k]) {
      byPeriod[k] = {
        key: k,

        // Sales
        sales_official_net: 0,
        sales_official_vat: 0,
        sales_official_gross: 0,

        sales_actual_net: 0,
        sales_actual_vat: 0,
        sales_actual_gross: 0,

        // Returns (as negative)
        returns_gross: 0,
        returns_cost: 0,
        returns_profit: 0,

        // COGS + Profit (sales based)
        cogs_total: 0,
        gross_profit: 0,

        // Purchases
        purchases_official_net: 0,
        purchases_official_vat: 0,
        purchases_official_gross: 0,

        purchases_actual_net: 0,
        purchases_actual_vat: 0,
        purchases_actual_gross: 0,

        // VAT position
        vat_out: 0, // sales
        vat_in: 0,  // purchases
      };
    }
    return byPeriod[k];
  };

  // ---- SALES LOOP
  salesSnap.forEach((docu) => {
    const s = docu.data();

    const d = tsToDate(s?.[dateField]) || tsToDate(s?.createdAt) || new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const type = s.saleType === "actual" ? "actual" : "official";

    const net = round2(s.netTotal);
    const vat = type === "official" ? round2(s.vatTotal) : 0;
    const gross = round2(s.grossTotal);

    const cost = round2(s.costTotalUsed ?? s.totalCost ?? 0);
    const profit = round2(s.profitTotal ?? (gross - cost));

    row.cogs_total += cost;
    row.gross_profit += profit;

    row.vat_out += vat;

    if (type === "official") {
      row.sales_official_net += net;
      row.sales_official_vat += vat;
      row.sales_official_gross += gross;
    } else {
      row.sales_actual_net += net;
      row.sales_actual_vat += 0;
      row.sales_actual_gross += gross;
    }
  });

  // ---- RETURNS LOOP (negatives)
  returnsSnap.forEach((docu) => {
    const s = docu.data();

    const d = tsToDate(s?.returnedAt) || tsToDate(s?.[dateField]) || tsToDate(s?.createdAt) || new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const gross = round2(s.grossTotal);
    const cost = round2(s.costTotalUsed ?? s.totalCost ?? 0);
    const profit = round2(s.profitTotal ?? (gross - cost));

    // returns should reduce totals
    row.returns_gross += gross;
    row.returns_cost += cost;
    row.returns_profit += profit;

    row.cogs_total -= cost;
    row.gross_profit -= profit;

    // VAT also should reverse if official
    const type = s.saleType === "actual" ? "actual" : "official";
    const vat = type === "official" ? round2(s.vatTotal) : 0;
    row.vat_out -= vat;
  });

  // ---- PURCHASE LOOP
  purchasesSnap.forEach((docu) => {
    const p = docu.data();

    const d = tsToDate(p?.[dateField]) || tsToDate(p?.createdAt) || new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const type = p.purchaseType === "actual" ? "actual" : "official";

    const net = round2(p?.totals?.net ?? 0);
    const vat = type === "official" ? round2(p?.totals?.vat ?? 0) : 0;
    const gross = round2(p?.totals?.gross ?? 0);

    row.vat_in += vat;

    if (type === "official") {
      row.purchases_official_net += net;
      row.purchases_official_vat += vat;
      row.purchases_official_gross += gross;
    } else {
      row.purchases_actual_net += net;
      row.purchases_actual_vat += 0;
      row.purchases_actual_gross += gross;
    }
  });

  // finalize + totals
  const rows = Object.values(byPeriod)
    .sort((a, b) => (a.key > b.key ? 1 : -1))
    .map((r) => {
      const sales_net =
        r.sales_official_net + r.sales_actual_net;
      const sales_gross =
        r.sales_official_gross + r.sales_actual_gross;

      const purchases_net =
        r.purchases_official_net + r.purchases_actual_net;

      const vat_payable = round2(r.vat_out - r.vat_in);

      const gross_margin = sales_gross > 0 ? round2((r.gross_profit / sales_gross) * 100) : 0;

      return {
        ...r,
        sales_net: round2(sales_net),
        sales_gross: round2(sales_gross),
        purchases_net: round2(purchases_net),
        vat_payable,
        gross_margin,
      };
    });

  const totals = rows.reduce(
    (acc, r) => {
      Object.keys(acc).forEach((k) => {
        acc[k] = round2(acc[k] + num(r[k]));
      });
      return acc;
    },
    {
      sales_official_net: 0,
      sales_official_vat: 0,
      sales_official_gross: 0,
      sales_actual_net: 0,
      sales_actual_gross: 0,

      purchases_official_net: 0,
      purchases_official_vat: 0,
      purchases_official_gross: 0,
      purchases_actual_net: 0,
      purchases_actual_gross: 0,

      cogs_total: 0,
      gross_profit: 0,
      vat_out: 0,
      vat_in: 0,
      returns_gross: 0,
      returns_cost: 0,
      returns_profit: 0,
    }
  );

  const sales_gross =
    totals.sales_official_gross + totals.sales_actual_gross;
  const gross_margin = sales_gross > 0 ? round2((totals.gross_profit / sales_gross) * 100) : 0;

  return {
    meta: { fromISO, toISO, period, dateField },
    totals: {
      ...totals,
      sales_gross: round2(sales_gross),
      sales_net: round2(totals.sales_official_net + totals.sales_actual_net),
      purchases_net: round2(totals.purchases_official_net + totals.purchases_actual_net),
      vat_payable: round2(totals.vat_out - totals.vat_in),
      gross_margin,
    },
    rows,
  };
}