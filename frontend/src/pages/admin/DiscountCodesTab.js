import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { cardCls, inputCls, labelCls, fmtDate, actBtn } from "./shared";

const BLANK = { code: "", type: "percent", value: "", max_uses: "", note: "" };

function CreateForm({ onCreated }) {
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const upd = (key, fx = (v) => v) => (e) => setForm({ ...form, [key]: fx(e.target.value) });

  const create = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const value = Number(form.value);
      await api.post("/admin/promo-codes", {
        code: form.code.trim() || null,
        percent_off: form.type === "percent" ? value : null,
        amount_off_czk: form.type === "amount" ? value : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        note: form.note,
        active: true,
      });
      toast.success("Discount code created");
      setForm(BLANK);
      onCreated();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cardCls} data-testid="promo-create-card">
      <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-5">New discount code</p>
      <form onSubmit={create} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Code (optional — auto)</label>
          <input placeholder="SUMMER20" className={inputCls} value={form.code} onChange={upd("code", (v) => v.toUpperCase())} data-testid="promo-code-input" />
        </div>
        <div>
          <label className={labelCls}>Discount type</label>
          <select className={inputCls} value={form.type} onChange={upd("type")} data-testid="promo-type-select">
            <option value="percent">Percent off (%)</option>
            <option value="amount">Fixed amount (CZK)</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{form.type === "percent" ? "Percent off (1–100)" : "Amount off per ticket (CZK)"}</label>
          <input required type="number" min="1" max={form.type === "percent" ? "100" : "5000"} className={inputCls} value={form.value} onChange={upd("value")} data-testid="promo-value-input" />
        </div>
        <div>
          <label className={labelCls}>Max uses (blank = unlimited)</label>
          <input type="number" min="1" placeholder="e.g. 50 tickets" className={inputCls} value={form.max_uses} onChange={upd("max_uses")} data-testid="promo-maxuses-input" />
        </div>
        <div className="lg:col-span-2">
          <label className={labelCls}>Note (internal)</label>
          <input placeholder="Instagram giveaway, radio spot…" className={inputCls} value={form.note} onChange={upd("note")} data-testid="promo-note-input" />
        </div>
        <button disabled={saving} data-testid="promo-create-button" className="sm:col-span-2 lg:col-span-3 bg-[#FF6A00] hover:bg-[#FF8534] disabled:opacity-50 text-white font-display font-bold uppercase text-xs py-3 rounded-full transition-colors">
          {saving ? "Creating…" : "Create discount code"}
        </button>
      </form>
      <p className="font-mono2 text-[10px] text-slate-600 mt-4">1 use = 1 discounted ticket sold with the code (paid orders only). Codes do not apply to the VIP Gold Table.</p>
    </div>
  );
}

function CodeCard({ p, onSave, onToggle, onDelete }) {
  const [edit, setEdit] = useState(null);
  const discount = p.amount_off_czk ? `−${p.amount_off_czk} Kč / ticket` : `−${p.percent_off}%`;
  const usage = p.max_uses ? `${p.uses} / ${p.max_uses}` : `${p.uses} / ∞`;

  return (
    <div className={cardCls} data-testid={`promo-card-${p.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display font-black text-lg sm:text-xl tracking-wide">{p.code}</p>
          <p className="font-mono2 text-xs text-[#FFE600] mt-1" data-testid={`promo-discount-${p.code}`}>{discount}</p>
          {p.note && <p className="text-xs text-slate-500 mt-1">{p.note}</p>}
          {p.created_at && <p className="font-mono2 text-[10px] text-slate-600 mt-1">Created {fmtDate(p.created_at)}</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`font-mono2 text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${p.active ? "border-green-400/40 text-green-400" : "border-white/15 text-slate-500"}`} data-testid={`promo-status-${p.code}`}>
            {p.active ? "Active" : "Inactive"}
          </span>
          <p className="font-mono2 text-xs text-slate-300" data-testid={`promo-uses-${p.code}`}>
            {usage} <span className="text-slate-500">uses</span>
          </p>
          <p className="font-mono2 text-[10px] text-slate-500">{p.orders} paid order(s)</p>
        </div>
      </div>

      {edit ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5 pt-5 border-t border-white/10">
          <div>
            <label className={labelCls}>Percent off</label>
            <input type="number" min="1" max="100" className={inputCls} value={edit.percent_off} onChange={(e) => setEdit({ ...edit, percent_off: e.target.value, amount_off_czk: "" })} data-testid={`promo-edit-percent-${p.code}`} />
          </div>
          <div>
            <label className={labelCls}>Amount off (CZK)</label>
            <input type="number" min="1" max="5000" className={inputCls} value={edit.amount_off_czk} onChange={(e) => setEdit({ ...edit, amount_off_czk: e.target.value, percent_off: "" })} data-testid={`promo-edit-amount-${p.code}`} />
          </div>
          <div>
            <label className={labelCls}>Max uses (0 = ∞)</label>
            <input type="number" min="0" className={inputCls} value={edit.max_uses} onChange={(e) => setEdit({ ...edit, max_uses: e.target.value })} data-testid={`promo-edit-maxuses-${p.code}`} />
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <input className={inputCls} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} data-testid={`promo-edit-note-${p.code}`} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
            <button className={actBtn} data-testid={`promo-save-${p.code}`} onClick={() => onSave(p.code, edit).then(() => setEdit(null))}>Save</button>
            <button className={actBtn} data-testid={`promo-cancel-${p.code}`} onClick={() => setEdit(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/10">
          <button className={actBtn} data-testid={`promo-edit-${p.code}`} onClick={() => setEdit({ percent_off: p.percent_off || "", amount_off_czk: p.amount_off_czk || "", max_uses: p.max_uses || 0, note: p.note || "" })}>Edit</button>
          <button className={actBtn} data-testid={`promo-toggle-${p.code}`} onClick={() => onToggle(p)}>{p.active ? "Deactivate" : "Activate"}</button>
          <button className={actBtn} data-testid={`promo-delete-${p.code}`} onClick={() => onDelete(p)}>Delete</button>
        </div>
      )}
    </div>
  );
}

export function DiscountCodesTab() {
  const [list, setList] = useState([]);
  const load = useCallback(() => api.get("/admin/promo-codes").then((r) => setList(r.data)).catch((e) => toast.error(formatError(e))), []);
  useEffect(() => { load(); }, [load]);

  const save = async (code, edit) => {
    try {
      await api.put(`/admin/promo-codes/${code}`, {
        percent_off: edit.percent_off ? Number(edit.percent_off) : null,
        amount_off_czk: edit.amount_off_czk ? Number(edit.amount_off_czk) : null,
        max_uses: Number(edit.max_uses) || 0,
        note: edit.note,
      });
      toast.success("Saved");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const toggle = async (p) => {
    try {
      await api.put(`/admin/promo-codes/${p.code}`, { active: !p.active });
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete discount code ${p.code}?`)) return;
    try {
      await api.delete(`/admin/promo-codes/${p.code}`);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(formatError(err));
    }
  };

  return (
    <div data-testid="discount-codes-tab">
      <CreateForm onCreated={load} />
      <div className="space-y-4 mt-8" data-testid="promo-list">
        {list.map((p) => (
          <CodeCard key={p.code} p={p} onSave={save} onToggle={toggle} onDelete={remove} />
        ))}
        {list.length === 0 && <p className="text-slate-600 font-mono2 text-xs">No discount codes yet</p>}
      </div>
    </div>
  );
}
