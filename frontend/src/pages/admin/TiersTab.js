import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError, czk } from "@/api";
import { EditDeleteButtons, cardCls, inputCls, labelCls, primaryBtn, shortId } from "./shared";

const blankTier = { event_id: "", name: "", price_czk: 0, capacity: 100, description: "", perks: "" };

function TierForm({ form, setForm, events, editingId, onSubmit }) {
  const upd = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <form onSubmit={onSubmit} className={`${cardCls} space-y-4 self-start`} data-testid="tier-form">
      <p className="font-display font-bold uppercase">{editingId ? "Edit tier" : "New tier"}</p>
      <div>
        <label className={labelCls}>Event</label>
        <select required className={inputCls} value={form.event_id} onChange={upd("event_id")} data-testid="tier-event-select">
          <option value="">Select event…</option>
          {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
      </div>
      <input required className={inputCls} placeholder="Tier name" value={form.name} onChange={upd("name")} data-testid="tier-name-input" />
      <div className="grid grid-cols-2 gap-4">
        <div><label className={labelCls}>Price (CZK)</label><input type="number" min="0" className={inputCls} value={form.price_czk} onChange={upd("price_czk")} data-testid="tier-price-input" /></div>
        <div><label className={labelCls}>Capacity</label><input type="number" min="1" className={inputCls} value={form.capacity} onChange={upd("capacity")} data-testid="tier-capacity-input" /></div>
      </div>
      <input className={inputCls} placeholder="Short description" value={form.description} onChange={upd("description")} />
      <div>
        <label className={labelCls}>Perks (comma separated)</label>
        <textarea rows={3} className={inputCls} value={form.perks} onChange={upd("perks")} data-testid="tier-perks-input" />
      </div>
      <button type="submit" data-testid="tier-save-button" className={primaryBtn}>
        {editingId ? "Save Changes" : "Create Tier"}
      </button>
    </form>
  );
}

export function TiersTab() {
  const [tiers, setTiers] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(blankTier);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(() => {
    api.get("/admin/tiers").then((r) => setTiers(r.data)).catch((e) => toast.error(formatError(e)));
    api.get("/admin/events").then((r) => {
      setEvents(r.data);
      const active = r.data.find((ev) => ev.active) || r.data[0];
      if (active) setForm((f) => (f.event_id ? f : { ...f, event_id: active.id }));
    }).catch((e) => console.warn("Admin tiers: events load failed", e));
  }, []);
  useEffect(() => { load(); }, [load]);

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
      if (editingId) await api.put(`/admin/tiers/${editingId}`, payload);
      else await api.post("/admin/tiers", payload);
      toast.success(editingId ? "Tier updated" : "Tier created");
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
          <div key={t.id} className={`${cardCls} flex items-start justify-between gap-4`} data-testid={`tier-card-${shortId(t.id)}`}>
            <div>
              <p className="font-display font-bold uppercase">{t.name} <span className="text-[#FFE600]">{czk(t.price_czk)}</span></p>
              <p className="font-mono2 text-xs text-slate-400 mt-1">{t.sold || 0} / {t.capacity} sold</p>
              <p className="text-slate-500 text-xs mt-2">{(t.perks || []).join(" · ")}</p>
            </div>
            <EditDeleteButtons onEdit={() => edit(t)} onDelete={() => remove(t)} testPrefix={`tier-${shortId(t.id)}`} />
          </div>
        ))}
      </div>
      <TierForm form={form} setForm={setForm} events={events} editingId={editingId} onSubmit={save} />
    </div>
  );
}
