import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Download, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { api, formatError, czk } from "@/api";
import AdminLogin from "@/components/AdminLogin";

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";
const labelCls = "font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5";
const cardCls = "border border-white/10 rounded-2xl bg-[#0D0E15] p-6";

function StatCard({ label, value, testid }) {
  return (
    <div className={cardCls} data-testid={testid}>
      <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-2">{label}</p>
      <p className="font-display font-black text-2xl sm:text-3xl text-[#FFE600]">{value}</p>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch((e) => toast.error(formatError(e)));
  }, []);
  if (!stats) return <p className="font-mono2 text-sm text-slate-500">Loading stats…</p>;
  return (
    <div className="space-y-8" data-testid="admin-overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={czk(stats.revenue_czk)} testid="stat-revenue" />
        <StatCard label="Tickets Sold" value={stats.tickets_sold} testid="stat-tickets-sold" />
        <StatCard label="Checked In" value={stats.checked_in} testid="stat-checked-in" />
        <StatCard label="Orders" value={stats.orders} testid="stat-orders" />
      </div>
      <div className={cardCls}>
        <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-6">Sales per tier</p>
        <div className="h-64" data-testid="sales-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.per_tier}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0D0E15", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}
                labelStyle={{ color: "#00F0FF" }}
              />
              <Bar dataKey="sold" name="Sold" fill="#FF0055" radius={[6, 6, 0, 0]} />
              <Bar dataKey="capacity" name="Capacity" fill="#262739" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const load = () => api.get("/admin/orders").then((r) => setOrders(r.data)).catch((e) => toast.error(formatError(e)));
  useEffect(() => { load(); }, []);

  const resend = async (id) => {
    try {
      await api.post(`/admin/orders/${id}/resend-email`);
      toast.success("Ticket email resent (same tickets)");
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const removeOrder = async (id) => {
    if (!window.confirm("Really delete this order and its tickets? The QR codes will stop working.")) return;
    try {
      const r = await api.delete(`/admin/orders/${id}`);
      toast.success(`Order deleted (${r.data.deleted_tickets} tickets removed)`);
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const filtered = orders.filter((o) => {
    const hay = `${o.buyer_name} ${o.buyer_email} ${o.tier_name} ${o.tickets.map((t) => t.code).join(" ")}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const exportCsv = () => {
    const rows = [["Order", "Date", "Buyer", "Email", "Tier", "Qty", "Amount CZK", "Codes", "Status"]];
    filtered.forEach((o) =>
      rows.push([o.id, o.created_at, o.buyer_name, o.buyer_email, o.tier_name, o.quantity, o.amount_czk, o.tickets.map((t) => t.code).join(" "), o.status])
    );
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "asia-takeover-orders.csv";
    a.click();
  };

  return (
    <div className="space-y-5" data-testid="admin-orders">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <SearchIcon />
          <input
            data-testid="orders-search-input"
            className={`${inputCls} pl-10`}
            placeholder="Search name, email or ticket code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          onClick={exportCsv}
          data-testid="orders-export-button"
          className="flex items-center justify-center gap-2 border border-white/15 hover:border-[#00F0FF] hover:text-[#00F0FF] font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-lg transition-colors"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto border border-white/10 rounded-2xl">
        <table className="w-full text-sm" data-testid="orders-table">
          <thead>
            <tr className="border-b border-white/10 bg-[#0D0E15] font-mono2 text-[11px] uppercase tracking-[0.15em] text-slate-500">
              {["Date", "Buyer", "Tier", "Qty", "Amount", "Ticket codes", "Payment", "Marketing", "Ticket email"].map((h) => (
                <th key={h} className="text-left px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-white/5 hover:bg-white/[0.03]" data-testid={`order-row-${o.id.slice(0, 8)}`}>
                <td className="px-4 py-3 font-mono2 text-xs text-slate-400 whitespace-nowrap">{new Date(o.created_at).toLocaleString("cs-CZ")}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{o.buyer_name}</p>
                  <p className="font-mono2 text-xs text-slate-500">{o.buyer_email}</p>
                </td>
                <td className="px-4 py-3 text-[#00F0FF] font-mono2 text-xs whitespace-nowrap">{o.tier_name}</td>
                <td className="px-4 py-3">{o.quantity}</td>
                <td className="px-4 py-3 text-[#FFE600] font-mono2 text-xs whitespace-nowrap">{czk(o.amount_czk)}</td>
                <td className="px-4 py-3 font-mono2 text-xs text-slate-400">
                  {o.tickets.map((t) => (
                    <span key={t.code} className={`inline-block mr-2 ${t.status === "used" ? "line-through text-slate-600" : ""}`}>{t.code}</span>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <span className={`font-mono2 text-[11px] uppercase tracking-wider ${
                    o.payment_status === "paid" || o.payment_status === "paid_mock" ? "text-emerald-400"
                    : o.payment_status === "created" || o.payment_status === "pending" ? "text-[#FFE600]"
                    : o.payment_status === "refunded" || o.payment_status === "partially_refunded" ? "text-[#FF6A00]"
                    : "text-[#FF0055]"
                  }`} data-testid={`order-status-${o.id.slice(0, 8)}`}>{o.payment_status}</span>
                  {o.paid_at && <p className="font-mono2 text-[10px] text-slate-600 mt-0.5">paid {new Date(o.paid_at).toLocaleString("cs-CZ")}</p>}
                  {o.gopay_payment_id && <p className="font-mono2 text-[10px] text-slate-600">gw {o.gopay_payment_id}</p>}
                  {o.teya_session_id && <p className="font-mono2 text-[10px] text-slate-600">teya {o.teya_session_id}</p>}
                </td>
                <td className="px-4 py-3 font-mono2 text-[11px] text-slate-400" data-testid={`order-marketing-${o.id.slice(0, 8)}`}>
                  {(() => {
                    const lt = o.attribution?.last_touch || {};
                    const bits = [lt.utm_source, lt.utm_medium, lt.utm_campaign, lt.utm_content, lt.utm_term].filter(Boolean);
                    const hasMeta = !!(o.attribution?.fbc || lt.fbclid);
                    return (
                      <>
                        {bits.length > 0 ? <p>{bits.join(" / ")}</p> : <p className="text-slate-600">direct</p>}
                        {hasMeta && <p className="text-[#00F0FF] mt-0.5">meta click ✓</p>}
                      </>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 font-mono2 text-[11px]" data-testid={`order-email-${o.id.slice(0, 8)}`}>
                  {o.ticket_email_sent_at ? (
                    <span className="text-emerald-400">sent {new Date(o.ticket_email_sent_at).toLocaleString("cs-CZ")}</span>
                  ) : o.ticket_email_error ? (
                    <span className="text-[#FF0055]">error: {o.ticket_email_error}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                  {(o.payment_status === "paid" || o.payment_status === "paid_mock") && (
                    <button
                      onClick={() => resend(o.id)}
                      data-testid={`resend-email-${o.id.slice(0, 8)}`}
                      className="block mt-1 text-[#00F0FF] hover:underline"
                    >
                      resend tickets
                    </button>
                  )}
                  <button
                    onClick={() => removeOrder(o.id)}
                    data-testid={`delete-order-${o.id.slice(0, 8)}`}
                    className="block mt-1 text-[#FF0055] hover:underline"
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500 font-mono2 text-xs">No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const blankEvent = {
  name: "", date: "", date_label: "", venue: "", address: "", city: "Prague",
  description: "", presented_by: "", genres: "", lineup: "[]", active: true, capacity: 1500,
};

function EventsTab() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(blankEvent);
  const [editingId, setEditingId] = useState(null);

  const load = () => api.get("/admin/events").then((r) => setEvents(r.data)).catch((e) => toast.error(formatError(e)));
  useEffect(() => { load(); }, []);

  const edit = (ev) => {
    setEditingId(ev.id);
    setForm({
      name: ev.name, date: ev.date || "", date_label: ev.date_label || "", venue: ev.venue || "",
      address: ev.address || "", city: ev.city || "Prague", description: ev.description || "",
      presented_by: ev.presented_by || "", genres: (ev.genres || []).join(", "),
      lineup: JSON.stringify(ev.lineup || [], null, 2), active: !!ev.active, capacity: ev.capacity || 1500,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (e) => {
    e.preventDefault();
    let lineup;
    try {
      lineup = JSON.parse(form.lineup || "[]");
      if (!Array.isArray(lineup)) throw new Error("Lineup must be a JSON array");
    } catch (err) {
      toast.error(`Lineup JSON invalid: ${err.message}`);
      return;
    }
    const payload = {
      name: form.name, date: form.date, date_label: form.date_label, venue: form.venue,
      address: form.address, city: form.city, description: form.description,
      presented_by: form.presented_by,
      genres: form.genres.split(",").map((g) => g.trim()).filter(Boolean),
      lineup, active: form.active, capacity: Number(form.capacity) || 1500,
    };
    try {
      if (editingId) {
        await api.put(`/admin/events/${editingId}`, payload);
        toast.success("Event updated");
      } else {
        await api.post("/admin/events", payload);
        toast.success("Event created");
      }
      setForm(blankEvent);
      setEditingId(null);
      load();
    } catch (e2) {
      toast.error(formatError(e2));
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this event and its ticket tiers?")) return;
    try {
      await api.delete(`/admin/events/${id}`);
      toast.success("Event deleted");
      load();
    } catch (e2) {
      toast.error(formatError(e2));
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8" data-testid="admin-events">
      <div className="space-y-4">
        <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400">Parties / events</p>
        {events.map((ev) => (
          <div key={ev.id} className={`${cardCls} flex items-start justify-between gap-4`} data-testid={`event-card-${ev.id.slice(0, 8)}`}>
            <div>
              <p className="font-display font-bold uppercase">{ev.name}</p>
              <p className="font-mono2 text-xs text-slate-400 mt-1">{ev.date_label} · {ev.venue} {ev.city}</p>
              <p className="font-mono2 text-[11px] mt-2">
                <span className={ev.active ? "text-emerald-400" : "text-slate-500"}>{ev.active ? "● LIVE ON SITE" : "○ HIDDEN"}</span>
                <span className="text-slate-500"> · {(ev.lineup || []).length} acts</span>
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => edit(ev)} data-testid={`event-edit-${ev.id.slice(0, 8)}`} className="p-2 border border-white/15 rounded-lg hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors"><Pencil size={15} /></button>
              <button onClick={() => remove(ev.id)} data-testid={`event-delete-${ev.id.slice(0, 8)}`} className="p-2 border border-white/15 rounded-lg hover:border-[#FF0055] hover:text-[#FF0055] transition-colors"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="font-mono2 text-xs text-slate-500">No events yet — create one.</p>}
      </div>
      <form onSubmit={save} className={`${cardCls} space-y-4 self-start`} data-testid="event-form">
        <div className="flex items-center justify-between">
          <p className="font-display font-bold uppercase">{editingId ? "Edit party" : "New party"}</p>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(blankEvent); }} className="font-mono2 text-[11px] text-slate-400 hover:text-white uppercase tracking-wider">Cancel</button>
          )}
        </div>
        <input required className={inputCls} placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="event-name-input" />
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Date label</label><input className={inputCls} placeholder="27.09.2026" value={form.date_label} onChange={(e) => setForm({ ...form, date_label: e.target.value })} data-testid="event-date-label-input" /></div>
          <div><label className={labelCls}>ISO date/time</label><input className={inputCls} placeholder="2026-09-27T22:00:00+02:00" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="event-date-input" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Venue</label><input className={inputCls} placeholder="DUPLEX" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} data-testid="event-venue-input" /></div>
          <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        </div>
        <input className={inputCls} placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        <input className={inputCls} placeholder="Presented by (e.g. DUPLEX × SEOULVIBES × GANGSHII)" value={form.presented_by} onChange={(e) => setForm({ ...form, presented_by: e.target.value })} />
        <textarea rows={3} className={inputCls} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="event-description-input" />
        <div>
          <label className={labelCls}>Genres (comma separated)</label>
          <input className={inputCls} placeholder="K-POP, HipHop/RnB, Vinahouse" value={form.genres} onChange={(e) => setForm({ ...form, genres: e.target.value })} data-testid="event-genres-input" />
        </div>
        <div>
          <label className={labelCls}>Lineup (JSON array: name, genre, stage, time, origin)</label>
          <textarea rows={8} className={`${inputCls} font-mono2 text-xs`} value={form.lineup} onChange={(e) => setForm({ ...form, lineup: e.target.value })} data-testid="event-lineup-input" />
        </div>
        <div className="grid grid-cols-2 gap-4 items-center">
          <div><label className={labelCls}>Capacity</label><input type="number" className={inputCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
          <label className="flex items-center gap-3 font-mono2 text-xs uppercase tracking-wider text-slate-300 pt-5">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-[#FF0055]" data-testid="event-active-toggle" />
            Live on site
          </label>
        </div>
        <button type="submit" data-testid="event-save-button" className="w-full bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors duration-300">
          {editingId ? "Save Changes" : "Create Party"}
        </button>
      </form>
    </div>
  );
}

const blankTier = { event_id: "", name: "", price_czk: 0, capacity: 100, description: "", perks: "" };

function TiersTab() {
  const [tiers, setTiers] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(blankTier);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    api.get("/admin/tiers").then((r) => setTiers(r.data)).catch((e) => toast.error(formatError(e)));
    api.get("/admin/events").then((r) => {
      setEvents(r.data);
      const active = r.data.find((ev) => ev.active) || r.data[0];
      if (active) setForm((f) => (f.event_id ? f : { ...f, event_id: active.id }));
    }).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const edit = (t) => {
    setEditingId(t.id);
    setForm({ event_id: t.event_id, name: t.name, price_czk: t.price_czk, capacity: t.capacity, description: t.description || "", perks: (t.perks || []).join(", ") });
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      event_id: form.event_id, name: form.name, price_czk: Number(form.price_czk) || 0,
      capacity: Number(form.capacity) || 1, description: form.description,
      perks: form.perks.split(",").map((p) => p.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api.put(`/admin/tiers/${editingId}`, payload);
        toast.success("Tier updated");
      } else {
        await api.post("/admin/tiers", payload);
        toast.success("Tier created");
      }
      setForm(blankTier);
      setEditingId(null);
      load();
    } catch (e2) {
      toast.error(formatError(e2));
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete tier "${t.name}"?`)) return;
    try {
      await api.delete(`/admin/tiers/${t.id}`);
      toast.success("Tier deleted");
      load();
    } catch (e2) {
      toast.error(formatError(e2));
    }
  };

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8" data-testid="admin-tiers">
      <div className="space-y-4">
        <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400">Ticket tiers</p>
        {tiers.map((t) => (
          <div key={t.id} className={`${cardCls} flex items-start justify-between gap-4`} data-testid={`tier-card-${t.id.slice(0, 8)}`}>
            <div>
              <p className="font-display font-bold uppercase">{t.name} <span className="text-[#FFE600]">{czk(t.price_czk)}</span></p>
              <p className="font-mono2 text-xs text-slate-400 mt-1">{t.sold || 0} / {t.capacity} sold</p>
              <p className="text-slate-500 text-xs mt-2">{(t.perks || []).join(" · ")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => edit(t)} data-testid={`tier-edit-${t.id.slice(0, 8)}`} className="p-2 border border-white/15 rounded-lg hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors"><Pencil size={15} /></button>
              <button onClick={() => remove(t)} data-testid={`tier-delete-${t.id.slice(0, 8)}`} className="p-2 border border-white/15 rounded-lg hover:border-[#FF0055] hover:text-[#FF0055] transition-colors"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={save} className={`${cardCls} space-y-4 self-start`} data-testid="tier-form">
        <p className="font-display font-bold uppercase">{editingId ? "Edit tier" : "New tier"}</p>
        <div>
          <label className={labelCls}>Event</label>
          <select required className={inputCls} value={form.event_id} onChange={(e) => setForm({ ...form, event_id: e.target.value })} data-testid="tier-event-select">
            <option value="">Select event…</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
        </div>
        <input required className={inputCls} placeholder="Tier name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="tier-name-input" />
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Price (CZK)</label><input type="number" min="0" className={inputCls} value={form.price_czk} onChange={(e) => setForm({ ...form, price_czk: e.target.value })} data-testid="tier-price-input" /></div>
          <div><label className={labelCls}>Capacity</label><input type="number" min="1" className={inputCls} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} data-testid="tier-capacity-input" /></div>
        </div>
        <input className={inputCls} placeholder="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div>
          <label className={labelCls}>Perks (comma separated)</label>
          <textarea rows={3} className={inputCls} value={form.perks} onChange={(e) => setForm({ ...form, perks: e.target.value })} data-testid="tier-perks-input" />
        </div>
        <button type="submit" data-testid="tier-save-button" className="w-full bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors duration-300">
          {editingId ? "Save Changes" : "Create Tier"}
        </button>
      </form>
    </div>
  );
}

function ContentTab() {
  const [form, setForm] = useState({ announcement: "", hero_sub: "", contact_email: "", instagram: "" });
  const [lockdown, setLockdown] = useState(true);
  useEffect(() => {
    api.get("/site").then((r) => {
      const c = r.data.content || {};
      setForm({
        announcement: c.announcement || "", hero_sub: c.hero_sub || "",
        contact_email: c.contact_email || "", instagram: c.instagram || "",
      });
    }).catch(() => {});
    api.get("/gate/status").then((r) => setLockdown(r.data.enabled)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put("/admin/content", form);
      await api.put("/admin/lockdown", { enabled: lockdown });
      toast.success(lockdown ? "Saved — site stays locked" : "Saved — SITE IS NOW PUBLIC");
    } catch (e2) {
      toast.error(formatError(e2));
    }
  };

  return (
    <form onSubmit={save} className={`${cardCls} max-w-2xl space-y-5`} data-testid="content-form">
      <p className="font-display font-bold uppercase">Edit site content</p>
      <label className="flex items-center justify-between gap-4 border border-white/10 rounded-xl px-4 py-3.5" data-testid="lockdown-toggle-row">
        <div>
          <p className="font-mono2 text-xs uppercase tracking-[0.2em] text-white">Site lockdown</p>
          <p className="font-mono2 text-[11px] text-slate-500 mt-1">
            {lockdown ? "Visitors see the password page" : "Site is open to the public"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLockdown(!lockdown)}
          data-testid="lockdown-toggle"
          className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${lockdown ? "bg-[#FF0055]" : "bg-emerald-500"}`}
        >
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 ${lockdown ? "left-1" : "left-7"}`} />
        </button>
      </label>
      <div>
        <label className={labelCls}>Announcement (marquee ribbon)</label>
        <input className={inputCls} value={form.announcement} onChange={(e) => setForm({ ...form, announcement: e.target.value })} data-testid="content-announcement-input" />
      </div>
      <div>
        <label className={labelCls}>Hero subtitle</label>
        <textarea rows={3} className={inputCls} value={form.hero_sub} onChange={(e) => setForm({ ...form, hero_sub: e.target.value })} data-testid="content-hero-sub-input" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Contact email</label>
          <input className={inputCls} value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} data-testid="content-email-input" />
        </div>
        <div>
          <label className={labelCls}>Instagram</label>
          <input className={inputCls} value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} data-testid="content-instagram-input" />
        </div>
      </div>
      <button type="submit" data-testid="content-save-button" className="bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm px-8 py-3.5 rounded-full transition-colors duration-300">
        Save Content
      </button>
    </form>
  );
}

function MessagesTab() {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    api.get("/admin/messages").then((r) => setMessages(r.data)).catch((e) => toast.error(formatError(e)));
  }, []);
  return (
    <div className="space-y-4 max-w-3xl" data-testid="admin-messages">
      {messages.map((m) => (
        <div key={m.id} className={cardCls} data-testid={`message-${m.id.slice(0, 8)}`}>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <p className="font-display font-bold text-sm uppercase">{m.name}</p>
            <span className="font-mono2 text-[11px] text-[#00F0FF] border border-[#00F0FF]/30 rounded-full px-2.5 py-0.5">{m.topic}</span>
            <span className="font-mono2 text-[11px] text-slate-500">{new Date(m.created_at).toLocaleString("cs-CZ")}</span>
          </div>
          <p className="font-mono2 text-xs text-slate-400 mb-2">{m.email}</p>
          <p className="text-sm text-slate-300 leading-relaxed">{m.message}</p>
        </div>
      ))}
      {messages.length === 0 && <p className="font-mono2 text-xs text-slate-500">No messages yet.</p>}
    </div>
  );
}

const TABS = [
  ["overview", "Overview"],
  ["orders", "Orders & Tickets"],
  ["events", "Parties"],
  ["tiers", "Ticket Tiers"],
  ["content", "Site Content"],
  ["messages", "Messages"],
];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false));
  }, []);

  if (user === null)
    return <div className="min-h-screen bg-[#060609] flex items-center justify-center font-mono2 text-xs text-slate-500 uppercase tracking-[0.3em]">Loading…</div>;
  if (user === false)
    return <AdminLogin title="Command Deck" subtitle="Sign in to manage ASIA TAKEOVER FESTIVAL" onLogin={setUser} testPrefix="admin" />;

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="admin-dashboard">
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between">
          <p className="font-display font-black uppercase text-sm sm:text-base">
            ATF <span className="text-[#FF0055]">✦</span> Command Deck
          </p>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block font-mono2 text-xs text-slate-500">{user.email}</span>
            <button onClick={logout} data-testid="admin-logout-button" className="flex items-center gap-2 font-mono2 text-xs uppercase tracking-wider text-slate-400 hover:text-[#FF0055] transition-colors">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>
      <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              data-testid={`admin-tab-${id}`}
              onClick={() => setTab(id)}
              className={`font-mono2 text-xs uppercase tracking-[0.15em] px-4 py-2.5 rounded-full border transition-colors duration-300 ${
                tab === id ? "bg-[#FF0055] border-[#FF0055] text-white" : "border-white/15 text-slate-400 hover:border-[#00F0FF] hover:text-[#00F0FF]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "overview" && <OverviewTab />}
        {tab === "orders" && <OrdersTab />}
        {tab === "events" && <EventsTab />}
        {tab === "tiers" && <TiersTab />}
        {tab === "content" && <ContentTab />}
        {tab === "messages" && <MessagesTab />}
      </div>
    </div>
  );
}
