import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { cardCls, inputCls, labelCls } from "./shared";
import { MessageCard } from "./MessageCard";
import { filterMessages } from "./messageUtils";

const FILTER_DEFAULTS = { floor: "all", statusF: "all", sort: "newest", minG: "", maxG: "", search: "" };

const SELECTS = [
  ["floor", "Floor", "messages-filter-floor", [["all", "All floors"], ["saigon", "Saigon Floor (5th)"], ["seoul", "Seoul Floor (7th)"], ["mainstream", "Mainstream Floor (6th) — legacy"]]],
  ["statusF", "Status", "messages-filter-status", [["all", "All active"], ["new", "New"], ["contacted", "Contacted"], ["confirmed", "Confirmed"], ["declined", "Declined"], ["removed", "Removed"]]],
  ["sort", "Sort", "messages-filter-sort", [["newest", "Newest"], ["oldest", "Oldest"], ["guests-asc", "Guests low–high"], ["guests-desc", "Guests high–low"]]],
];

function MessagesFilters({ filters, setFilters }) {
  const upd = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  return (
    <div className={`${cardCls} !p-4`} data-testid="messages-filters">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SELECTS.map(([key, label, tid, options]) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <select className={inputCls} value={filters[key]} onChange={upd(key)} data-testid={tid}>
              {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <div>
          <label className={labelCls}>Min guests</label>
          <input type="number" min="1" className={inputCls} value={filters.minG} onChange={upd("minG")} data-testid="messages-filter-min-guests" />
        </div>
        <div>
          <label className={labelCls}>Max guests</label>
          <input type="number" min="1" className={inputCls} value={filters.maxG} onChange={upd("maxG")} data-testid="messages-filter-max-guests" />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Search</label>
          <input className={inputCls} value={filters.search} onChange={upd("search")} placeholder="Name, email or phone" data-testid="messages-filter-search" />
        </div>
      </div>
    </div>
  );
}

const EMPTY_EDIT = { status: {}, notes: {}, floor: {} };

export function MessagesTab() {
  const [messages, setMessages] = useState([]);
  const [filters, setFilters] = useState(FILTER_DEFAULTS);
  const [edit, setEditState] = useState(EMPTY_EDIT);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const load = useCallback(() => api.get("/admin/messages").then((r) => setMessages(r.data)).catch((e) => toast.error(formatError(e))), []);
  useEffect(() => { load(); }, [load]);

  const setEdit = (field, id, value) => setEditState((s) => ({ ...s, [field]: { ...s[field], [id]: value } }));
  const clearEdit = (id) =>
    setEditState((s) => {
      const next = { status: { ...s.status }, notes: { ...s.notes }, floor: { ...s.floor } };
      Object.values(next).forEach((m) => delete m[id]);
      return next;
    });

  const run = async (fn, okMsg) => {
    try {
      await fn();
      toast.success(okMsg);
      load();
    } catch (e) {
      toast.error(formatError(e));
    }
  };

  const saveMessage = (id) => {
    const payload = {};
    if (edit.status[id] !== undefined) payload.status = edit.status[id];
    if (edit.notes[id] !== undefined) payload.notes = edit.notes[id];
    if (edit.floor[id] !== undefined) payload.floor = edit.floor[id];
    if (!Object.keys(payload).length) return;
    run(async () => {
      await api.put(`/admin/messages/${id}`, payload);
      clearEdit(id);
    }, "Saved");
  };
  const remove = (id) => run(async () => {
    await api.post(`/admin/messages/${id}/remove`);
    setConfirmRemove(null);
  }, "Moved to Removed");
  const restore = (id) => run(() => api.post(`/admin/messages/${id}/restore`), "Restored");

  const filtered = filterMessages(messages, filters);

  return (
    <div className="space-y-4 max-w-3xl" data-testid="admin-messages">
      <MessagesFilters filters={filters} setFilters={setFilters} />
      {filtered.map((m) => (
        <MessageCard
          key={m.id}
          m={m}
          edit={edit}
          setEdit={setEdit}
          confirming={confirmRemove === m.id}
          setConfirmRemove={setConfirmRemove}
          onSave={() => saveMessage(m.id)}
          onRemove={() => remove(m.id)}
          onRestore={() => restore(m.id)}
        />
      ))}
      {filtered.length === 0 && <p className="font-mono2 text-xs text-slate-500" data-testid="messages-empty">No messages match the current filters.</p>}
    </div>
  );
}
