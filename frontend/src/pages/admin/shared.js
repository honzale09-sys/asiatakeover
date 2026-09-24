import { Pencil, Trash2 } from "lucide-react";

export const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";
export const labelCls = "font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5";
export const cardCls = "border border-white/10 rounded-2xl bg-[#0D0E15] p-6";
export const actBtn =
  "font-mono2 text-[10px] uppercase tracking-[0.1em] border border-white/15 hover:border-[#00F0FF] hover:text-[#00F0FF] rounded-lg px-2.5 py-1.5 transition-colors";
export const primaryBtn =
  "w-full bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors duration-300";

export const shortId = (id) => id.slice(0, 8);
export const fmtDate = (iso) => new Date(iso).toLocaleString("cs-CZ");

export function StatCard({ label, value, testid }) {
  return (
    <div className={cardCls} data-testid={testid}>
      <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-2">{label}</p>
      <p className="font-display font-black text-2xl sm:text-3xl text-[#FFE600]">{value}</p>
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function EditDeleteButtons({ onEdit, onDelete, testPrefix }) {
  return (
    <div className="flex gap-2 shrink-0">
      <button onClick={onEdit} data-testid={`${testPrefix}-edit`} className="p-2 border border-white/15 rounded-lg hover:border-[#00F0FF] hover:text-[#00F0FF] transition-colors"><Pencil size={15} /></button>
      <button onClick={onDelete} data-testid={`${testPrefix}-delete`} className="p-2 border border-white/15 rounded-lg hover:border-[#FF0055] hover:text-[#FF0055] transition-colors"><Trash2 size={15} /></button>
    </div>
  );
}
