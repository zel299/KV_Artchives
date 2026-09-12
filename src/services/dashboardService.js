
const { supabaseAdmin } = require("../config/supabase");
const money = require("../utils/money");

async function getStats() {
  const [sales, orders, transactions, customers] = await Promise.all([
    totalSales(),
    countOrders(),
    countTransactions(),
    countCustomers(),
  ]);

  return { sales, orders, transactions, customers };
}

async function totalSales() {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("amount_due")
    .eq("status", "confirmed");

  if (error) throw new Error(`totalSales failed: ${error.message}`);

  return money.toAmount(
    (data || []).reduce((sum, row) => sum + Number(row.amount_due), 0)
  );
}

async function countOrders() {
  const { count, error } = await supabaseAdmin
    .from("orders")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error(`countOrders failed: ${error.message}`);
  return count || 0;
}

async function countTransactions() {
  const { count, error } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed");

  if (error) throw new Error(`countTransactions failed: ${error.message}`);
  return count || 0;
}

async function countCustomers() {
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer");

  if (error) throw new Error(`countCustomers failed: ${error.message}`);
  return count || 0;
}

const ACTIVE_STATUSES = [
  "pending",
  "confirmed",
  "awaiting_down_payment",
  "in_production",
  "awaiting_balance",
  "ready_to_ship",
  "shipped",
];

async function statusOverview() {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("status");

  if (error) throw new Error(`statusOverview failed: ${error.message}`);

  const counts = {};
  for (const row of data || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }

  return ACTIVE_STATUSES.map((status) => ({
    status,
    count: counts[status] || 0,
  }));
}

async function unitsSold(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select("quantity, orders!inner ( placed_at, status )")
    .gte("orders.placed_at", since.toISOString())
    .not("orders.status", "in", "(declined,expired,cancelled)");

  if (error) throw new Error(`unitsSold failed: ${error.message}`);

  const byDay = {};
  for (const row of data || []) {
    const day = row.orders.placed_at.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + row.quantity;
  }

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, units: byDay[key] || 0 });
  }

  return series;
}

async function recentOrders(limit = 5) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("id, code, status, subtotal, placed_at, ship_full_name")
    .order("placed_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`recentOrders failed: ${error.message}`);

  return (data || []).map((row) => ({
    id: row.id,
    code: row.code,
    status: row.status,
    subtotal: Number(row.subtotal),
    placedAt: row.placed_at,
    customerName: row.ship_full_name,
  }));
}

module.exports = { getStats, statusOverview, unitsSold, recentOrders };