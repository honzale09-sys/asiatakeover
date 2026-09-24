import { useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { cardCls, inputCls } from "./shared";

function GuestRow({ g }) {
  const used = g.status === "used";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-white/5 rounded-lg px-3 py-2.5 text-xs" data-testid={`guest-row-${g.code}`}>
      <div className="min-w-0">
        <p className="text-slate-200 truncate">{g.buyer_email}</p>
        <p className="font-mono2 text-[10px] text-slate-500">{g.code} · {g.created_at?.slice(0, 16).replace("T", " ")}</p>
      </div>
      <span
        className={`font-mono2 text-[10px] font-bold uppercase tracking-[0.15em] rounded-full px-2.5 py-1 border ${
          used ? "text-green-400 border-green-400/30" : "text-[#C9A227] border-[#C9A227]/30"
        }`}
      >
        {used ? "Checked In" : "Sent"}
      </span>
    </div>
  );
}

export function VipGuestListCard({ stats, onSent }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const list = stats?.vip_guest_list || [];
  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const r = await api.post("/admin/vip-guest-list", { email: email.trim() });
      toast.success(`VIP Guest List ticket ${r.data.code} sent to ${r.data.email}`);
      setEmail("");
      onSent();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <div className={cardCls} data-testid="vip-guest-list-card">
      <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-[#C9A227] mb-2">VIP Guest List</p>
      <p className="font-display font-black text-2xl sm:text-3xl text-[#C9A227] mb-6" data-testid="guest-stats">
        {stats?.categories?.vip_guest_list?.sent ?? 0} <span className="text-sm text-slate-500 font-bold">SENT</span>
        <span className="text-slate-600 mx-2">/</span>
        {stats?.categories?.vip_guest_list?.checked_in ?? 0} <span className="text-sm text-slate-500 font-bold">CHECKED IN</span>
      </p>
      <form onSubmit={send} className="flex gap-2 mb-6">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter guest email" data-testid="guest-email-input" className={inputCls} />
        <button
          type="submit"
          disabled={sending}
          data-testid="guest-send-button"
          className="whitespace-nowrap bg-[#C9A227] hover:bg-[#dbb53a] disabled:opacity-50 text-black font-display font-bold uppercase text-xs px-5 rounded-lg transition-colors"
        >
          {sending ? "Sending…" : "Send ticket"}
        </button>
      </form>
      <div className="space-y-2 max-h-72 overflow-y-auto" data-testid="guest-list">
        {list.map((g) => <GuestRow key={g.code} g={g} />)}
        {list.length === 0 && <p className="text-slate-600 text-xs font-mono2">No guest tickets sent yet</p>}
      </div>
    </div>
  );
}
