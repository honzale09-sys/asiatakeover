import { useState } from "react";
import { actBtn, cardCls, inputCls } from "./shared";

export function rewardStatus(a) {
  if (a.reward_vip?.sent) return { label: a.reward_vip.upgraded ? "VIP SENT (upgraded)" : "VIP SENT", cls: "text-[#C9A227]" };
  if (a.vip_eligible) return { label: "VIP ELIGIBLE", cls: "text-[#C9A227]" };
  if (a.reward_standard?.sent) return { label: "STANDARD SENT", cls: "text-[#00F0FF]" };
  if (a.std_eligible) return { label: "STANDARD ELIGIBLE", cls: "text-[#00F0FF]" };
  return { label: "—", cls: "text-slate-500" };
}

function EditForm({ a, onSave, onCancel }) {
  const [editing, setEditing] = useState({ name: a.name, instagram: a.instagram, email: a.email, discount_czk: a.discount_czk ?? 50 });
  const upd = (key) => (e) => setEditing({ ...editing, [key]: e.target.value });
  return (
    <div className="grid sm:grid-cols-3 gap-2 mt-4">
      <input className={inputCls} value={editing.name} onChange={upd("name")} data-testid="amb-edit-name" />
      <input className={inputCls} value={editing.instagram} onChange={upd("instagram")} data-testid="amb-edit-instagram" />
      <input className={inputCls} value={editing.email} onChange={upd("email")} data-testid="amb-edit-email" />
      <input type="number" min="1" max="2000" placeholder="Discount amount (CZK)" className={inputCls} value={editing.discount_czk} onChange={upd("discount_czk")} data-testid="amb-edit-discount" />
      <div className="sm:col-span-3 flex gap-2">
        <button onClick={() => onSave(editing)} data-testid="amb-edit-save" className={actBtn}>Save</button>
        <button onClick={onCancel} className={actBtn}>Cancel</button>
      </div>
    </div>
  );
}

function Actions({ a, code, onEdit, act, onToggle, copy }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4">
      <button onClick={() => copy(a.code, "Code")} data-testid={`amb-copy-code-${code}`} className={actBtn}>Copy code</button>
      <button onClick={() => copy(a.referral_url, "Link")} data-testid={`amb-copy-link-${code}`} className={actBtn}>Copy link</button>
      <a href={`/api/admin/ambassadors/${a.id}/qr.png`} download data-testid={`amb-qr-${code}`} className={actBtn}>Download QR</a>
      <button onClick={onEdit} data-testid={`amb-edit-${code}`} className={actBtn}>Edit</button>
      {a.std_eligible && (
        <button onClick={() => act("send-reward", { type: "standard" })} data-testid={`amb-send-std-${code}`} className={`${actBtn} border-[#00F0FF] text-[#00F0FF]`}>Send reward (Standard)</button>
      )}
      {a.vip_eligible && !a.reward_standard?.sent && (
        <button onClick={() => act("send-reward", { type: "vip" })} data-testid={`amb-send-vip-${code}`} className={`${actBtn} border-[#C9A227] text-[#C9A227]`}>Send reward (VIP)</button>
      )}
      {a.can_upgrade && (
        <button onClick={() => act("upgrade-reward")} data-testid={`amb-upgrade-${code}`} className={`${actBtn} border-[#C9A227] text-[#C9A227]`}>Upgrade to VIP</button>
      )}
      {a.fifty_eligible && (
        <button onClick={() => act("fifty-code")} data-testid={`amb-fifty-btn-${code}`} className={`${actBtn} border-[#FFE600] text-[#FFE600]`}>Create 50% code</button>
      )}
      <button onClick={onToggle} data-testid={`amb-toggle-${code}`} className={`${actBtn} ${a.active ? "border-[#FF0055] text-[#FF0055]" : "border-green-400 text-green-400"}`}>
        {a.active ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}

export function AmbassadorCard({ a, editing, onStartEdit, onCancelEdit, onSaveEdit, act, onToggle, copy }) {
  const reward = rewardStatus(a);
  return (
    <div className={cardCls} data-testid={`amb-row-${a.code}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display font-bold text-base uppercase">{a.name} {!a.active && <span className="text-[#FF0055] text-xs">(INACTIVE)</span>}</p>
          <p className="font-mono2 text-[11px] text-slate-500">{a.instagram || "—"} · {a.email}</p>
          <p className="font-mono2 text-[11px] text-[#00F0FF] mt-1">
            Code: <span className="text-white">{a.code}</span> · <span data-testid={`amb-discount-${a.code}`}>−{a.discount_czk ?? 50} Kč / ticket</span> · Sales: {a.sales}/10
          </p>
          {a.fifty && (
            <p className="font-mono2 text-[11px] mt-1" data-testid={`amb-fifty-${a.code}`}>
              50% code: <span className="text-white">{a.fifty.code}</span>{" "}
              {a.fifty.redeemed ? <span className="text-[#FF0055] font-bold">REDEEMED</span> : <span className="text-green-400">ACTIVE</span>}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`font-mono2 text-[11px] font-bold uppercase tracking-wider ${reward.cls}`} data-testid={`amb-reward-${a.code}`}>{reward.label}</p>
          <div className="flex items-center justify-end gap-2 mt-2">
            <span className="font-mono2 text-[11px] text-slate-400">Stories {a.stories_shared}/8</span>
            <button onClick={() => act("stories", { delta: -1 })} data-testid={`amb-stories-minus-${a.code}`} className={actBtn}>−</button>
            <button onClick={() => act("stories", { delta: 1 })} data-testid={`amb-stories-plus-${a.code}`} className={actBtn}>+</button>
          </div>
        </div>
      </div>
      {editing ? (
        <EditForm a={a} onSave={onSaveEdit} onCancel={onCancelEdit} />
      ) : (
        <Actions a={a} code={a.code} onEdit={onStartEdit} act={act} onToggle={onToggle} copy={copy} />
      )}
    </div>
  );
}
