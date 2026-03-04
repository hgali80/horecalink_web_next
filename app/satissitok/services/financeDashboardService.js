// app/satissitok/services/financeDashboardService.js
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
function tsToDate(v) {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function loadFinanceDashboard({
  fromISO,
  toISO,
  dateField = "documentDate", // sales/purchases
}) {
  if (!fromISO || !toISO) throw new Error("fromISO ve toISO zorunlu");

  const start = toStartOfDay(new Date(fromISO));
  const end = toEndOfDay(new Date(toISO));
  const startTS = Timestamp.fromDate(start);
  const endTS = Timestamp.fromDate(end);

  // =========================
  // SALES / RETURNS
  // =========================
  const salesQ = query(
    collection(db, "sales"),
    where("status", "==", "completed"),
    where(dateField, ">=", startTS),
    where(dateField, "<=", endTS)
  );

  const returnsQ = query(
    collection(db, "sales"),
    where("status", "==", "returned"),
    where("returnedAt", ">=", startTS),
    where("returnedAt", "<=", endTS)
  );

  // =========================
  // PURCHASES
  // =========================
  const purchasesQ = query(
    collection(db, "purchases"),
    where("status", "==", "completed"),
    where(dateField, ">=", startTS),
    where(dateField, "<=", endTS)
  );

  // =========================
  // CASH: EXPENSE + OTHER INCOME
  // =========================
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

  // =========================
  // STOCK VALUE (all)
  // =========================
  const stockBalancesQ = query(collection(db, "stock_balances"));

  // =========================
  // CARIS (open AR/AP snapshot fields)
  // =========================
  const carisQ = query(collection(db, "caris"));

  const [
    salesSnap,
    returnsSnap,
    purchasesSnap,
    expensesSnap,
    otherIncomeSnap,
    stockSnap,
    carisSnap,
  ] = await Promise.all([
    getDocs(salesQ),
    getDocs(returnsQ),
    getDocs(purchasesQ),
    getDocs(expensesQ),
    getDocs(otherIncomeQ),
    getDocs(stockBalancesQ),
    getDocs(carisQ),
  ]);

  const out = {
    // SALES
    sales_official_net: 0,
    sales_official_vat: 0,
    sales_official_gross: 0,
    sales_actual_net: 0,
    sales_actual_gross: 0,

    // RETURNS
    returns_net: 0,
    returns_vat: 0,
    returns_gross: 0,

    // PURCHASES
    purchases_official_net: 0,
    purchases_official_vat: 0,
    purchases_official_gross: 0,
    purchases_actual_net: 0,
    purchases_actual_gross: 0,

    // COST/PROFIT
    cogs_total: 0,
    gross_profit: 0, // net-based

    // CASH
    opex_net: 0,
    opex_vat: 0,
    other_income_net: 0,
    other_income_vat: 0,

    // VAT POSITION
    vat_out: 0,
    vat_in: 0,

    // STOCK VALUE
    inventory_value_official: 0,
    inventory_value_actual: 0,

    // OPEN AR/AP
    open_receivable: 0,
    open_payable: 0,
  };

  // ---- SALES
  salesSnap.forEach((d) => {
    const s = d.data();
    const type = s.saleType === "actual" ? "actual" : "official";
    const net = round2(s.netTotal);
    const vat = type === "official" ? round2(s.vatTotal) : 0;
    const gross = round2(s.grossTotal);

    const cost = round2(s.costTotalUsed ?? 0);
    const profit = round2(s.profitTotal ?? (net - cost));

    out.cogs_total += cost;
    out.gross_profit += profit;

    out.vat_out += vat;

    if (type === "official") {
      out.sales_official_net += net;
      out.sales_official_vat += vat;
      out.sales_official_gross += gross;
    } else {
      out.sales_actual_net += net;
      out.sales_actual_gross += gross;
    }
  });

  // ---- RETURNS (reverse)
  returnsSnap.forEach((d) => {
    const s = d.data();
    const type = s.saleType === "actual" ? "actual" : "official";

    const net = round2(s.netTotal);
    const vat = type === "official" ? round2(s.vatTotal) : 0;
    const gross = round2(s.grossTotal);

    const cost = round2(s.costTotalUsed ?? 0);
    const profit = round2(s.profitTotal ?? (net - cost));

    out.returns_net += net;
    out.returns_vat += vat;
    out.returns_gross += gross;

    out.cogs_total -= cost;
    out.gross_profit -= profit;

    out.vat_out -= vat;

    // satış toplamlarını da net/gross olarak etkilemek istersen burada düşebilirsin.
    // şimdilik return KPI ayrı kalsın.
  });

  // ---- PURCHASES
  purchasesSnap.forEach((d) => {
    const p = d.data();
    const type = p.purchaseType === "actual" ? "actual" : "official";

    const net = round2(p?.totals?.net ?? 0);
    const vat = type === "official" ? round2(p?.totals?.vat ?? 0) : 0;
    const gross = round2(p?.totals?.gross ?? 0);

    out.vat_in += vat;

    if (type === "official") {
      out.purchases_official_net += net;
      out.purchases_official_vat += vat;
      out.purchases_official_gross += gross;
    } else {
      out.purchases_actual_net += net;
      out.purchases_actual_gross += gross;
    }
  });

  // ---- EXPENSES (OPEX)
  expensesSnap.forEach((d) => {
    const t = d.data();
    const net = round2(t.amountNet ?? t.amount ?? 0);
    const vat = round2(t.vatAmount ?? 0);

    out.opex_net += net;
    out.opex_vat += vat;

    // gider KDV’si indirilecek KDV olarak VAT IN’e eklenir
    out.vat_in += vat;
  });

  // ---- OTHER INCOME
  otherIncomeSnap.forEach((d) => {
    const t = d.data();
    const net = round2(t.amountNet ?? t.amount ?? 0);
    const vat = round2(t.vatAmount ?? 0);

    out.other_income_net += net;
    out.other_income_vat += vat;

    // gelir KDV’si varsa VAT OUT
    out.vat_out += vat;
  });

  // ---- STOCK VALUE (qty * avgCost)
  // stock_balances içinde legacy + warehouses yapısı var; ikisini de destekliyoruz.
  stockSnap.forEach((d) => {
    const b = d.data() || {};

    // legacy buckets (official/actual)
    const legacyOfficialQty = num(b?.official?.qty ?? 0);
    const legacyOfficialAvg = num(b?.official?.avgCost ?? 0);
    const legacyActualQty = num(b?.actual?.qty ?? 0);
    const legacyActualAvg = num(b?.actual?.avgCost ?? 0);

    out.inventory_value_official += round2(legacyOfficialQty * legacyOfficialAvg);
    out.inventory_value_actual += round2(legacyActualQty * legacyActualAvg);

    // warehouses buckets
    const whs = b?.warehouses || {};
    for (const whKey of Object.keys(whs)) {
      const wh = whs[whKey] || {};
      const off = wh?.official || {};
      const act = wh?.actual || {};
      out.inventory_value_official += round2(num(off.qty) * num(off.avgCost));
      out.inventory_value_actual += round2(num(act.qty) * num(act.avgCost));
    }
  });

  // ---- OPEN AR/AP (caris fields varsa)
  carisSnap.forEach((d) => {
    const c = d.data() || {};
    // olası alan isimleri: receivable/payable, balance, debit/credit vs.
    const receivable = num(c.receivable ?? c.openReceivable ?? 0);
    const payable = num(c.payable ?? c.openPayable ?? 0);

    // balance alanı varsa: (+) alacak, (-) borç gibi kullananlar var
    const balance = c.balance != null ? num(c.balance) : null;

    if (balance != null && receivable === 0 && payable === 0) {
      if (balance > 0) out.open_receivable += balance;
      if (balance < 0) out.open_payable += Math.abs(balance);
    } else {
      out.open_receivable += receivable;
      out.open_payable += payable;
    }
  });

  // ---- derived
  const sales_net = round2(out.sales_official_net + out.sales_actual_net);
  const sales_gross = round2(out.sales_official_gross + out.sales_actual_gross);

  const purchases_net = round2(out.purchases_official_net + out.purchases_actual_net);

  const vat_payable = round2(out.vat_out - out.vat_in);

  const net_profit = round2(out.gross_profit + out.other_income_net - out.opex_net);

  const gross_margin = sales_net > 0 ? round2((out.gross_profit / sales_net) * 100) : 0;
  const net_margin = sales_net > 0 ? round2((net_profit / sales_net) * 100) : 0;

  return {
    meta: { fromISO, toISO, dateField },
    kpis: {
      ...out,
      sales_net,
      sales_gross,
      purchases_net,
      vat_payable,
      net_profit,
      gross_margin,
      net_margin,
      inventory_value_total: round2(out.inventory_value_official + out.inventory_value_actual),
    },
  };
}