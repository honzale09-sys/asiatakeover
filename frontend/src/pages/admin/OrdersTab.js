import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, MailWarning } from "lucide-react";
import { api, formatError } from "@/api";
import { SearchIcon, inputCls } from "./shared";
import { OrderRow } from "./OrderRow";
import { downloadOrdersCsv, matchesFilters, isPaid } from "./orderUtils";

const HEADERS = ["Date", "Buyer", "Category", "Tier", "Qty", "Amount", "Ticket codes", "Payment", "Marketing", "Ticket email"];

function OrdersToolbar({ q, setQ, cat, setCat, showAbandoned, onToggleAbandoned, onExport }) {
  const toolBtn = "flex items-center justify-center gap-2 border font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-lg transition-colors";
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <SearchIcon />
        <input data-testid="orders-search-input" className={`${inputCls} pl-10`} placeholder="Search name, email or ticket code…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <select data-testid="orders-category-filter" className={`${inputCls} !w-auto`} value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="all">All</option>
        <option value="standard">Standard Ticket</option>
        <option value="vip">VIP Table Ticket</option>
        <option value="gold">VIP Gold Table Ticket</option>
      </select>
      <button onClick={onExport} data-testid="orders-export-button" className={`${toolBtn} border-white/15 hover:border-[#00F0FF] hover:text-[#00F0FF]`}>
        <Download size={14} /> Export CSV
      </button>
      <button
        onClick={onToggleAbandoned}
        data-testid="orders-show-abandoned-toggle"
        className={`${toolBtn} ${showAbandoned ? "border-[#FFE600] text-[#FFE600]" : "border-white/15 hover:border-[#FFE600] hover:text-[#FFE600]"}`}
      >
        Abandoned {showAbandoned ? "ON" : "OFF"}
      </button>
    </div>
  );
}

function useAmbassadorNames() {
  const [ambNames, setAmbNames] = useState({});
  useEffect(() => {
    api.get("/admin/ambassadors").then((r) => {
      const m = {};
      r.data.forEach((a) => {
        m[a.code] = a.name;
        if (a.fifty?.code) m[a.fifty.code] = `${a.name} (50%)`;
      });
      setAmbNames(m);
    }).catch((e) => console.warn("Admin orders: ambassador names failed", e));
  }, []);
  return ambNames;
}

export function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [showAbandoned, setShowAbandoned] = useState(false);
  const ambNames = useAmbassadorNames();
  const load = useCallback(() => {
    setLoading(true);
    return api
      .get(`/admin/orders${showAbandoned ? "?include_unpaid=1" : ""}`)
      .then((r) => setOrders(r.data))
      .catch((e) => toast.error(formatError(e)))
      .finally(() => setLoading(false));
  }, [showAbandoned]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    try {
      await fn();
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };
  const syncPayment = (id) => run(async () => {
    const r = await api.post(`/admin/orders/${id}/sync-payment`);
    const st = r.data.payment_status;
    if (st === "paid") toast.success(`Payment confirmed — ${r.data.tickets} ticket(s) issued and email queued`);
    else toast.info(`Teya still reports: ${st}`);
  });
  const resend = (id) => run(async () => {
    await api.post(`/admin/orders/${id}/resend-email`);
    toast.success("Ticket email resent (same tickets)");
  });  const removeOrder = (id) => {
    if (!window.confirm("Really delete this order and its tickets? The QR codes will stop working.")) return;
    run(async () => {
      const r = await api.delete(`/admin/orders/${id}`);
      toast.success(`Order deleted (${r.data.deleted_tickets} tickets removed)`);
    });
  };

  const [resendingAll, setResendingAll] = useState(false);
  const undelivered = orders.filter(
    (o) => isPaid(o) && !o.ticket_email_sent_at && !/Undeliverable/i.test(o.ticket_email_error || "")
  );
  const resendAll = async () => {
    if (!window.confirm(`Resend tickets to ${undelivered.length} paid buyer(s) who never received their email? They get the exact same QR codes — no new tickets are created.`)) return;
    setResendingAll(true);
    try {
      const r = await api.post("/admin/orders/resend-unsent");
      toast.success(`Sent ${r.data.sent} of ${r.data.candidates} undelivered ticket email(s)`);
      const failed = (r.data.results || []).filter((x) => !x.ok);
      if (failed.length) toast.warning(`${failed.length} could not be sent (check the Ticket email column)`);
      await load();
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setResendingAll(false);
    }
  };

  const filtered = orders.filter((o) => matchesFilters(o, { q, cat }));

  return (
    <div className="space-y-5" data-testid="admin-orders">
      {undelivered.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#FFE600]/40 bg-[#FFE600]/[0.06] rounded-2xl px-5 py-4" data-testid="undelivered-banner">
          <div className="flex items-start gap-3">
            <MailWarning size={18} className="text-[#FFE600] mt-0.5 shrink-0" />
            <div>
              <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600]">
                {undelivered.length} paid buyer(s) never received their ticket
              </p>
              <p className="font-mono2 text-[11px] text-slate-400 mt-1">
                Resend the exact same QR codes now — no new tickets are created.
              </p>
            </div>
          </div>
          <button
            onClick={resendAll}
            disabled={resendingAll}
            data-testid="resend-all-undelivered"
            className="shrink-0 font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-lg border border-[#FFE600] text-[#FFE600] hover:bg-[#FFE600] hover:text-black transition-colors disabled:opacity-40"
          >
            {resendingAll ? "Sending…" : "Resend all now"}
          </button>
        </div>
      )}
      <OrdersToolbar
        q={q} setQ={setQ} cat={cat} setCat={setCat}
        showAbandoned={showAbandoned}
        onToggleAbandoned={() => setShowAbandoned((v) => !v)}
        onExport={() => downloadOrdersCsv(filtered)}
      />
      <div className="overflow-x-auto border border-white/10 rounded-2xl">
        <table className="w-full text-sm" data-testid="orders-table">
          <thead>
            <tr className="border-b border-white/10 bg-[#0D0E15] font-mono2 text-[11px] uppercase tracking-[0.15em] text-slate-500">
              {HEADERS.map((h) => <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <OrderRow key={o.id} o={o} ambNames={ambNames} onSync={syncPayment} onResend={resend} onDelete={removeOrder} />
            ))}
            {loading && orders.length === 0 && (
              <tr><td colSpan={HEADERS.length} className="px-4 py-10 text-center text-slate-500 font-mono2 text-xs" data-testid="orders-loading">Loading orders…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={HEADERS.length} className="px-4 py-10 text-center text-slate-500 font-mono2 text-xs">No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
