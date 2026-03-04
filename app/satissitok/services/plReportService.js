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
 * ✅ Net Profit P&L
 * - Sales profit uses sale.profitTotal (net based)
 * - Operating expenses from cash_transactions (txType=expense)
 * - Other income from cash_transactions (txType=other_income)
 */
export async function loadPLReport({
  fromISO,
  toISO,
  period = "month",
  dateField = "documentDate", // sales & purchases date field
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

  // -------------------------
  // CASH TX: EXPENSE + OTHER INCOME
  // -------------------------
  const expensesQ = query(
    collection(db, "cash_transactions"),
    where("txType", "==", "expense"),
    where("operationDate", ">=", startTS),
    where("operationDate", "<=", endTS)
  );

  const otherIncomeQ = query(
    collection(db, "cash_transactions"),
    where("txType", "==", "other_income"),
    where("operationDate", ">=", startTS),
    where("operationDate", "<=", endTS)
  );

  const [salesSnap, returnsSnap, purchasesSnap, expensesSnap, otherIncomeSnap] =
    await Promise.all([
      getDocs(salesQ),
      getDocs(returnsQ),
      getDocs(purchasesQ),
      getDocs(expensesQ),
      getDocs(otherIncomeQ),
    ]);

  const byPeriod = {};
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

        // Returns (as negative impact)
        returns_net: 0,
        returns_vat: 0,
        returns_gross: 0,
        returns_cost: 0,
        returns_profit: 0,

        // COGS + Gross Profit (NET based)
        cogs_total: 0,
        gross_profit: 0, // sale.profitTotal net-based

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

        // OPEX + Other income
        opex_net: 0,
        opex_vat: 0,
        opex_gross: 0,

        other_income_net: 0,
        other_income_vat: 0,
        other_income_gross: 0,
      };
    }
    return byPeriod[k];
  };

  // ---- SALES
  salesSnap.forEach((docu) => {
    const s = docu.data();
    const d =
      tsToDate(s?.[dateField]) || tsToDate(s?.createdAt) || new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const type = s.saleType === "actual" ? "actual" : "official";

    const net = round2(s.netTotal);
    const vat = type === "official" ? round2(s.vatTotal) : 0;
    const gross = round2(s.grossTotal);

    const cost = round2(s.costTotalUsed ?? 0);
    const profit = round2(s.profitTotal ?? (net - cost)); // NET based

    row.cogs_total += cost;
    row.gross_profit += profit;

    row.vat_out += vat;

    if (type === "official") {
      row.sales_official_net += net;
      row.sales_official_vat += vat;
      row.sales_official_gross += gross;
    } else {
      row.sales_actual_net += net;
      row.sales_actual_gross += gross;
    }
  });

  // ---- RETURNS (reverse)
  returnsSnap.forEach((docu) => {
    const s = docu.data();
    const d =
      tsToDate(s?.returnedAt) ||
      tsToDate(s?.[dateField]) ||
      tsToDate(s?.createdAt) ||
      new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const type = s.saleType === "actual" ? "actual" : "official";

    const net = round2(s.netTotal);
    const vat = type === "official" ? round2(s.vatTotal) : 0;
    const gross = round2(s.grossTotal);

    const cost = round2(s.costTotalUsed ?? 0);
    const profit = round2(s.profitTotal ?? (net - cost));

    row.returns_net += net;
    row.returns_vat += vat;
    row.returns_gross += gross;
    row.returns_cost += cost;
    row.returns_profit += profit;

    row.cogs_total -= cost;
    row.gross_profit -= profit;

    row.vat_out -= vat;
  });

  // ---- PURCHASES
  purchasesSnap.forEach((docu) => {
    const p = docu.data();
    const d =
      tsToDate(p?.[dateField]) || tsToDate(p?.createdAt) || new Date();
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
      row.purchases_actual_gross += gross;
    }
  });

  // ---- EXPENSES
  expensesSnap.forEach((docu) => {
    const t = docu.data();
    const d = tsToDate(t?.operationDate) || tsToDate(t?.createdAt) || new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const net = round2(t.amountNet ?? t.amount ?? 0);
    const vat = round2(t.vatAmount ?? 0);
    const gross = round2(t.amountGross ?? t.amount ?? (net + vat));

    row.opex_net += net;
    row.opex_vat += vat;
    row.opex_gross += gross;

    // gider KDV’si varsa (faturalı gider), KDV iade/indirilecek: VAT IN
    row.vat_in += vat;
  });

  // ---- OTHER INCOME
  otherIncomeSnap.forEach((docu) => {
    const t = docu.data();
    const d = tsToDate(t?.operationDate) || tsToDate(t?.createdAt) || new Date();
    const k = pickPeriodKey(d, period);
    const row = ensure(k);

    const net = round2(t.amountNet ?? t.amount ?? 0);
    const vat = round2(t.vatAmount ?? 0);
    const gross = round2(t.amountGross ?? t.amount ?? (net + vat));

    row.other_income_net += net;
    row.other_income_vat += vat;
    row.other_income_gross += gross;

    // gelir KDV’si varsa VAT OUT
    row.vat_out += vat;
  });

  // finalize rows
  const rows = Object.values(byPeriod)
    .sort((a, b) => (a.key > b.key ? 1 : -1))
    .map((r) => {
      const sales_net = r.sales_official_net + r.sales_actual_net;
      const purchases_net = r.purchases_official_net + r.purchases_actual_net;

      const vat_payable = round2(r.vat_out - r.vat_in);

      // NET PROFIT:
      // gross_profit (already net-based) + other_income_net - opex_net
      const net_profit = round2(r.gross_profit + r.other_income_net - r.opex_net);

      const gross_margin = sales_net > 0 ? round2((r.gross_profit / sales_net) * 100) : 0;
      const net_margin = sales_net > 0 ? round2((net_profit / sales_net) * 100) : 0;

      return {
        ...r,
        sales_net: round2(sales_net),
        purchases_net: round2(purchases_net),
        vat_payable,
        gross_margin,
        net_profit,
        net_margin,
      };
    });

  const totals = rows.reduce(
    (acc, r) => {
      for (const k of Object.keys(acc)) {
        acc[k] = round2(acc[k] + num(r[k]));
      }
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

      opex_net: 0,
      opex_vat: 0,
      opex_gross: 0,

      other_income_net: 0,
      other_income_vat: 0,
      other_income_gross: 0,

      returns_net: 0,
      returns_vat: 0,
      returns_gross: 0,
      returns_cost: 0,
      returns_profit: 0,

      sales_net: 0,
      purchases_net: 0,
      net_profit: 0,
    }
  );

  const sales_net_total = round2(totals.sales_official_net + totals.sales_actual_net);
  const net_profit_total = round2(totals.gross_profit + totals.other_income_net - totals.opex_net);

  return {
    meta: { fromISO, toISO, period, dateField },
    totals: {
      ...totals,
      sales_net: sales_net_total,
      purchases_net: round2(totals.purchases_official_net + totals.purchases_actual_net),
      vat_payable: round2(totals.vat_out - totals.vat_in),
      gross_margin: sales_net_total > 0 ? round2((totals.gross_profit / sales_net_total) * 100) : 0,
      net_profit: net_profit_total,
      net_margin: sales_net_total > 0 ? round2((net_profit_total / sales_net_total) * 100) : 0,
    },
    rows,
  };
}