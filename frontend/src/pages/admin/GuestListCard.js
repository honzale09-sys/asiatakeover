import { useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { cardCls, inputCls } from "./shared";

const CONFIG = {
  vip: {
    label: "VIP Guest List", accent: "text-[#C9A227]", btn: "bg-[#C9A227] hover:bg-[#dbb53a]",
    badge: "text-[#C9A227] border-[#C9A227]/30", tier: "VIP Guest List",
    note: "VIP wristband · no surprise gift", statsKey: "vip_guest_list",
  },
  standard: {
    label: "Standard Guest List", accent: "text-[#00F0FF]", btn: "bg-[#00F0FF] hover:bg-[#5cf6ff]",
    badge: "text-[#00F0FF] border-[#00F0FF]/30", tier: "Standard Guest List",
    note: "Standard wristband · no surprise gift", statsKey: "standard_guest_list",
  },
};

function GuestRow({ g, badge }) {
  const used = g.status === "used";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-white/5 rounded-lg px-3 py-2.5 text-xs" data-testid={`guest-row-${g.code}`}>
      <div className="min-w-0">
        <p className="text-slate-200 truncate">{g.buyer_email}</p>
        <p className="font-mono2 text-[10px] text-slate-500">{g.code} · {g.created_at?.slice(0, 16).replace("T", " ")}</p>
      </div>
      <span className={`font-mono2 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full px-2.5 py-1 border ${used ? "text-green-400 border-green-400/30" : badge}`}>
        {used ? "Checked In" : "Sent"}
      </span>
    </div>
  );
}

export function GuestListCard({ category, stats, onSent }) {
  const c = CONFIG[category];
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState("1");
  const [sending, setSending] = useState(false);
  const counts = stats?.categories?.[c.statsKey] || {};
  const list = (stats?.guest_tickets || []).filter((g) => g.tier_name === c.tier);

  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const quantity = Math.max(1, Math.min(20, Number(qty) || 1));
      const r = await api.post("/admin/guest-list", { email: email.trim(), quantity, category });
      toast.success(`${r.data.quantity} ${c.label} ticket(s) sent to ${r.data.email} — ${r.data.codes.join(", ")}`);
      setEmail("");
      setQty("1");
      onSent();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cardCls} data-testid={`guest-list-card-${category}`}>
      <p className={`font-mono2 text-[11px] uppercase tracking-[0.25em] mb-2 ${c.accent}`}>{c.label}</p>
      <p className={`font-display font-black text-2xl sm:text-3xl mb-1 ${c.accent}`} data-testid={`guest-stats-${category}`}>
        {counts.sent ?? 0} <span className="text-sm text-slate-500 font-bold">SENT</span>
        <span className="text-slate-600 mx-2">/</span>
        {counts.checked_in ?? 0} <span className="text-sm text-slate-500 font-bold">CHECKED IN</span>
      </p>
      <p className="font-mono2 text-[10px] text-slate-500 mb-5">{c.note}</p>
      <form onSubmit={send} className="flex flex-wrap gap-2 mb-5">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter guest email" data-testid={`guest-email-input-${category}`}
          className={`${inputCls} flex-1 min-w-[160px]`}
        />
        <input
          type="number" min="1" max="20" value={qty} onChange={(e) => setQty(e.target.value)}
          data-testid={`guest-qty-input-${category}`} aria-label="Quantity"
          className={`${inputCls} !w-20 text-center`}
        />
        <button
          type="submit" disabled={sending} data-testid={`guest-send-button-${category}`}
          className={`whitespace-nowrap ${c.btn} disabled:opacity-50 text-black font-display font-bold uppercase text-xs px-5 py-2.5 rounded-lg transition-colors`}
        >
          {sending ? "Sending…" : "Send tickets"}
        </button>
      </form>
      <p className="font-mono2 text-[10px] text-slate-600 mb-3">1 ticket = 1 unique QR = 1 person. All tickets arrive in one email, each QR shown separately.</p>
      <div className="space-y-2 max-h-72 overflow-y-auto" data-testid={`guest-list-${category}`}>
        {list.map((g) => <GuestRow key={g.code} g={g} badge={c.badge} />)}
        {list.length === 0 && <p className="text-slate-600 text-xs font-mono2">No guest tickets sent yet</p>}
      </div>
    </div>
  );
}
