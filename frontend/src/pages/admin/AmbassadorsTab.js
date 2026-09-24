import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { cardCls, inputCls } from "./shared";
import { AmbassadorCard } from "./AmbassadorCard";

const BLANK = { name: "", instagram: "", email: "", code: "", discount: "50" };

function overviewCards(list) {
  const count = (fn) => list.filter(fn).length;
  return [
    ["Active Ambassadors", count((a) => a.active), "amb-active"],
    ["Total Ambassador Sales", list.reduce((s, a) => s + a.sales, 0), "amb-sales"],
    ["Standard Eligible / Sent", `${count((a) => a.std_eligible)} / ${count((a) => a.reward_standard?.sent)}`, "amb-std"],
    ["VIP Eligible / Sent", `${count((a) => a.vip_eligible)} / ${count((a) => a.reward_vip?.sent)}`, "amb-vip"],
    ["50% Eligible / Redeemed", `${count((a) => a.fifty_eligible)} / ${count((a) => a.fifty?.redeemed)}`, "amb-fifty"],
  ];
}

function CreateForm({ onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const upd = (key, fx = (v) => v) => (e) => setForm({ ...form, [key]: fx(e.target.value) });
  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/admin/ambassadors", { ...form, code: form.code || null, discount_czk: Number(form.discount) || 50 });
      toast.success("Ambassador created");
      setForm(BLANK);
      onCreated();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={cardCls} data-testid="ambassador-create-card">
      <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-5">New Ambassador</p>
      <form onSubmit={create} className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="Name" className={inputCls} value={form.name} onChange={upd("name")} data-testid="amb-name-input" />
        <input placeholder="Instagram (e.g. @handle)" className={inputCls} value={form.instagram} onChange={upd("instagram")} data-testid="amb-instagram-input" />
        <input required type="email" placeholder="Email" className={inputCls} value={form.email} onChange={upd("email")} data-testid="amb-email-input" />
        <input placeholder="Personal discount code (optional — auto)" className={inputCls} value={form.code} onChange={upd("code", (v) => v.toUpperCase())} data-testid="amb-code-input" />
        <input required type="number" min="1" max="2000" placeholder="Discount amount (CZK)" className={inputCls} value={form.discount} onChange={upd("discount")} data-testid="amb-discount-input" />
        <button disabled={saving} data-testid="amb-create-button" className="sm:col-span-2 bg-[#FF6A00] hover:bg-[#FF8534] disabled:opacity-50 text-white font-display font-bold uppercase text-xs py-3 rounded-full transition-colors">
          {saving ? "Creating…" : "Create Ambassador"}
        </button>
      </form>
    </div>
  );
}

export function AmbassadorsTab() {
  const [list, setList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const load = useCallback(() => api.get("/admin/ambassadors").then((r) => setList(r.data)).catch((e) => toast.error(formatError(e))), []);
  useEffect(() => { load(); }, [load]);

  const copy = (text, what) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`));
  const run = async (fn) => {
    try {
      await fn();
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const saveEdit = (id, editing) => run(async () => {
    await api.put(`/admin/ambassadors/${id}`, { ...editing, discount_czk: Number(editing.discount_czk) || undefined });
    toast.success("Saved");
    setEditingId(null);
  });
  const act = (id) => (action, payload = {}) => run(() => api.post(`/admin/ambassadors/${id}/${action}`, payload));
  const toggle = (a) => run(() => api.put(`/admin/ambassadors/${a.id}`, { active: !a.active }));

  return (
    <div data-testid="ambassadors-tab">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-8">
        {overviewCards(list).map(([label, val, tid]) => (
          <div key={tid} className={cardCls} data-testid={tid}>
            <p className="font-mono2 text-[9px] uppercase tracking-[0.15em] text-slate-400 mb-2">{label}</p>
            <p className="font-display font-black text-2xl">{val}</p>
          </div>
        ))}
      </div>
      <CreateForm onCreated={load} />
      <div className="space-y-4 mt-8" data-testid="ambassador-list">
        {list.map((a) => (
          <AmbassadorCard
            key={a.id}
            a={a}
            editing={editingId === a.id}
            onStartEdit={() => setEditingId(a.id)}
            onCancelEdit={() => setEditingId(null)}
            onSaveEdit={(editing) => saveEdit(a.id, editing)}
            act={act(a.id)}
            onToggle={() => toggle(a)}
            copy={copy}
          />
        ))}
        {list.length === 0 && <p className="text-slate-600 font-mono2 text-xs">No ambassadors yet</p>}
      </div>
    </div>
  );
}
