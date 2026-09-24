import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { EditDeleteButtons, cardCls, inputCls, labelCls, primaryBtn, shortId } from "./shared";

const blankEvent = {
  name: "", date: "", date_label: "", venue: "", address: "", city: "Prague",
  description: "", presented_by: "", genres: "", lineup: "[]", active: true, capacity: 1500,
};

const eventToForm = (ev) => ({
  name: ev.name, date: ev.date || "", date_label: ev.date_label || "", venue: ev.venue || "",
  address: ev.address || "", city: ev.city || "Prague", description: ev.description || "",
  presented_by: ev.presented_by || "", genres: (ev.genres || []).join(", "),
  lineup: JSON.stringify(ev.lineup || [], null, 2), active: !!ev.active, capacity: ev.capacity || 1500,
});

function parseLineup(raw) {
  const lineup = JSON.parse(raw || "[]");
  if (!Array.isArray(lineup)) throw new Error("Lineup must be a JSON array");
  return lineup;
}

function EventCard({ ev, onEdit, onDelete }) {
  return (
    <div className={`${cardCls} flex items-start justify-between gap-4`} data-testid={`event-card-${shortId(ev.id)}`}>
      <div>
        <p className="font-display font-bold uppercase">{ev.name}</p>
        <p className="font-mono2 text-xs text-slate-400 mt-1">{ev.date_label} · {ev.venue} {ev.city}</p>
        <p className="font-mono2 text-[11px] mt-2">
          <span className={ev.active ? "text-emerald-400" : "text-slate-500"}>{ev.active ? "● LIVE ON SITE" : "○ HIDDEN"}</span>
          <span className="text-slate-500"> · {(ev.lineup || []).length} acts</span>
        </p>
      </div>
      <EditDeleteButtons onEdit={onEdit} onDelete={onDelete} testPrefix={`event-${shortId(ev.id)}`} />
    </div>
  );
}

function EventForm({ form, setForm, editingId, onCancel, onSubmit }) {
  const upd = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <form onSubmit={onSubmit} className={`${cardCls} space-y-4 self-start`} data-testid="event-form">
      <div className="flex items-center justify-between">
        <p className="font-display font-bold uppercase">{editingId ? "Edit party" : "New party"}</p>
        {editingId && (
          <button type="button" onClick={onCancel} className="font-mono2 text-[11px] text-slate-400 hover:text-white uppercase tracking-wider">Cancel</button>
        )}
      </div>
      <input required className={inputCls} placeholder="Event name" value={form.name} onChange={upd("name")} data-testid="event-name-input" />
      <div className="grid grid-cols-2 gap-4">
        <div><label className={labelCls}>Date label</label><input className={inputCls} placeholder="27.09.2026" value={form.date_label} onChange={upd("date_label")} data-testid="event-date-label-input" /></div>
        <div><label className={labelCls}>ISO date/time</label><input className={inputCls} placeholder="2026-09-27T22:00:00+02:00" value={form.date} onChange={upd("date")} data-testid="event-date-input" /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className={labelCls}>Venue</label><input className={inputCls} placeholder="DUPLEX" value={form.venue} onChange={upd("venue")} data-testid="event-venue-input" /></div>
        <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={upd("city")} /></div>
      </div>
      <input className={inputCls} placeholder="Address" value={form.address} onChange={upd("address")} />
      <input className={inputCls} placeholder="Presented by (e.g. DUPLEX × SEOULVIBES × GANGSHII)" value={form.presented_by} onChange={upd("presented_by")} />
      <textarea rows={3} className={inputCls} placeholder="Description" value={form.description} onChange={upd("description")} data-testid="event-description-input" />
      <div>
        <label className={labelCls}>Genres (comma separated)</label>
        <input className={inputCls} placeholder="K-POP, HipHop/RnB, Vinahouse" value={form.genres} onChange={upd("genres")} data-testid="event-genres-input" />
      </div>
      <div>
        <label className={labelCls}>Lineup (JSON array: name, genre, stage, time, origin)</label>
        <textarea rows={8} className={`${inputCls} font-mono2 text-xs`} value={form.lineup} onChange={upd("lineup")} data-testid="event-lineup-input" />
      </div>
      <div className="grid grid-cols-2 gap-4 items-center">
        <div><label className={labelCls}>Capacity</label><input type="number" className={inputCls} value={form.capacity} onChange={upd("capacity")} /></div>
        <label className="flex items-center gap-3 font-mono2 text-xs uppercase tracking-wider text-slate-300 pt-5">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4 accent-[#FF0055]" data-testid="event-active-toggle" />
          Live on site
        </label>
      </div>
      <button type="submit" data-testid="event-save-button" className={primaryBtn}>
        {editingId ? "Save Changes" : "Create Party"}
      </button>
    </form>
  );
}

export function EventsTab() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(blankEvent);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(() => api.get("/admin/events").then((r) => setEvents(r.data)).catch((e) => toast.error(formatError(e))), []);
  useEffect(() => { load(); }, [load]);

  const edit = (ev) => {
    setEditingId(ev.id);
    setForm(eventToForm(ev));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reset = () => {
    setEditingId(null);
    setForm(blankEvent);
  };

  const save = async (e) => {
    e.preventDefault();
    let lineup;
    try {
      lineup = parseLineup(form.lineup);
    } catch (err) {
      toast.error(`Lineup JSON invalid: ${err.message}`);
      return;
    }
    const payload = {
      name: form.name, date: form.date, date_label: form.date_label, venue: form.venue,
      address: form.address, city: form.city, description: form.description, presented_by: form.presented_by,
      genres: form.genres.split(",").map((g) => g.trim()).filter(Boolean),
      lineup, active: form.active, capacity: Number(form.capacity) || 1500,
    };
    try {
      if (editingId) await api.put(`/admin/events/${editingId}`, payload);
      else await api.post("/admin/events", payload);
      toast.success(editingId ? "Event updated" : "Event created");
      reset();
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
        {events.map((ev) => <EventCard key={ev.id} ev={ev} onEdit={() => edit(ev)} onDelete={() => remove(ev.id)} />)}
        {events.length === 0 && <p className="font-mono2 text-xs text-slate-500">No events yet — create one.</p>}
      </div>
      <EventForm form={form} setForm={setForm} editingId={editingId} onCancel={reset} onSubmit={save} />
    </div>
  );
}
