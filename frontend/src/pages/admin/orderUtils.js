export const PAID_STATUSES = ["paid", "paid_mock"];
const PENDING_STATUSES = ["created", "pending"];
const REFUND_STATUSES = ["refunded", "partially_refunded"];

export const isPaid = (o) => PAID_STATUSES.includes(o.payment_status);
export const isPending = (o) => PENDING_STATUSES.includes(o.payment_status);

export function orderCategory(o) {
  const n = (o.tier_name || "").toLowerCase();
  if (n.includes("gold")) return "gold";
  if (n.includes("vip")) return "vip";
  return "standard";
}

export function categoryLabel(o) {
  const n = o.tier_name || "";
  if (o.guest_list) return "Guest List";
  if (/ambassador/i.test(n)) return "Ambassador";
  if (/gold/i.test(n)) return "VIP Gold";
  if (/vip/i.test(n)) return "VIP Table";
  return "Standard";
}

export function paymentStatusCls(status) {
  if (PAID_STATUSES.includes(status)) return "text-emerald-400";
  if (PENDING_STATUSES.includes(status)) return "text-[#FFE600]";
  if (REFUND_STATUSES.includes(status)) return "text-[#FF6A00]";
  return "text-[#FF0055]";
}

export function matchesFilters(o, { q, cat }) {
  if (cat !== "all" && orderCategory(o) !== cat) return false;
  const hay = `${o.buyer_name} ${o.buyer_email} ${o.tier_name} ${o.tickets.map((t) => t.code).join(" ")}`.toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function downloadOrdersCsv(orders) {
  const rows = [["Order", "Date", "Buyer", "Email", "Tier", "Qty", "Amount CZK", "Codes", "Status"]];
  orders.forEach((o) =>
    rows.push([o.id, o.created_at, o.buyer_name, o.buyer_email, o.tier_name, o.quantity, o.amount_czk, o.tickets.map((t) => t.code).join(" "), o.status])
  );
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "asia-takeover-orders.csv";
  a.click();
}
