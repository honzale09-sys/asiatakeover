import { actBtn, cardCls, fmtDate, inputCls, shortId } from "./shared";
import { ASSIGNABLE_FLOORS, MSG_STATUSES, MSG_STATUS_STYLES } from "./messageUtils";

function FloorSelect({ m, value, onChange, testid }) {
  const legacy = m.floor && !ASSIGNABLE_FLOORS.includes(m.floor);
  return (
    <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={value} onChange={onChange} data-testid={testid}>
      <option value="">No floor assigned</option>
      {ASSIGNABLE_FLOORS.map((f) => <option key={f} value={f}>{f}</option>)}
      {legacy && <option value={m.floor} disabled>{m.floor} (legacy)</option>}
    </select>
  );
}

function RemoveControls({ short, confirming, onConfirm, onCancel, onAsk }) {
  if (confirming) {
    return (
      <>
        <button onClick={onConfirm} className="font-mono2 text-[10px] uppercase tracking-[0.1em] border border-[#FF0055] text-[#FF0055] rounded-lg px-2.5 py-1.5 transition-colors" data-testid={`message-remove-confirm-${short}`}>Confirm remove</button>
        <button onClick={onCancel} className={actBtn} data-testid={`message-remove-cancel-${short}`}>Cancel</button>
      </>
    );
  }
  return <button onClick={onAsk} className={`${actBtn} hover:border-[#FF0055] hover:text-[#FF0055]`} data-testid={`message-remove-${short}`}>Remove</button>;
}

export function MessageCard({ m, edit, setEdit, confirming, setConfirmRemove, onSave, onRemove, onRestore }) {
  const st = m.status || "new";
  const short = shortId(m.id);
  const pending = edit.status[m.id];
  const dirty = (pending && pending !== st) || edit.notes[m.id] !== undefined || edit.floor[m.id] !== undefined;
  const setField = (field) => (e) => setEdit(field, m.id, e.target.value);
  const badgeCls = m.removed ? "text-slate-500 border-white/15" : MSG_STATUS_STYLES[st];

  return (
    <div className={cardCls} data-testid={`message-${short}`}>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <p className="font-display font-bold text-sm uppercase">{m.name}</p>
        <span className="font-mono2 text-[11px] text-[#00F0FF] border border-[#00F0FF]/30 rounded-full px-2.5 py-0.5">{m.topic}</span>
        <span className={`font-mono2 text-[11px] border rounded-full px-2.5 py-0.5 ${badgeCls}`} data-testid={`message-status-${short}`}>
          {m.removed ? "Removed" : st}
        </span>
        <span className="font-mono2 text-[11px] text-slate-500">{fmtDate(m.created_at)}</span>
      </div>
      <p className="font-mono2 text-xs text-slate-400 mb-2">
        {m.email}
        {m.phone && <span className="text-slate-500"> · {m.phone}</span>}
      </p>
      {(m.guests || m.floor) && (
        <p className="font-mono2 text-xs text-[#C9A227] mb-2" data-testid={`message-meta-${short}`}>
          {m.guests && `${m.guests} guests`}{m.guests && m.floor && " · "}{m.floor}
        </p>
      )}
      <p className="text-sm text-slate-300 leading-relaxed">{m.message}</p>
      {!m.removed && (
        <textarea
          rows={2}
          className={`${inputCls} mt-3 text-xs`}
          placeholder="Internal note… (visible to all admins)"
          value={edit.notes[m.id] ?? m.notes ?? ""}
          onChange={setField("notes")}
          data-testid={`message-notes-${short}`}
        />
      )}
      <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
        {m.removed ? (
          <button onClick={onRestore} className={actBtn} data-testid={`message-restore-${short}`}>Restore</button>
        ) : (
          <>
            <select className={`${inputCls} !w-auto !py-1.5 text-xs`} value={pending ?? st} onChange={setField("status")} data-testid={`message-status-select-${short}`}>
              {MSG_STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
            {("guests" in m || "floor" in m) && (
              <FloorSelect m={m} value={edit.floor[m.id] ?? m.floor ?? ""} onChange={setField("floor")} testid={`message-floor-select-${short}`} />
            )}
            {dirty && (
              <button onClick={onSave} className={`${actBtn} border-[#00F0FF] text-[#00F0FF]`} data-testid={`message-status-save-${short}`}>Save</button>
            )}
            <RemoveControls short={short} confirming={confirming} onConfirm={onRemove} onCancel={() => setConfirmRemove(null)} onAsk={() => setConfirmRemove(m.id)} />
          </>
        )}
      </div>
    </div>
  );
}
