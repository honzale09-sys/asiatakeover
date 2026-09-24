import { Check, X } from "lucide-react";

const ICONS = {
  check: <Check size={15} className="text-green-400 mt-0.5 shrink-0" />,
  cross: <X size={15} className="text-[#FF0055] mt-0.5 shrink-0" />,
  trophy: <span className="mt-0.5 shrink-0 text-sm leading-none">🏆</span>,
  diamond: <span className="mt-0.5 shrink-0 text-sm leading-none text-[#E7C55A]">◆</span>,
};

// items: [{ text, icon: "check" | "cross" | "trophy" | "diamond" }]
export function PerksList({ items, testid, className = "" }) {
  return (
    <ul className={`space-y-2.5 text-sm text-slate-300 mb-6 ${className}`} data-testid={testid}>
      {items.map((p) => (
        <li key={p.text} className="flex items-start gap-2.5">
          {ICONS[p.icon]} {p.text}
        </li>
      ))}
    </ul>
  );
}

const keys = (prefix, n) => Array.from({ length: n }, (_, i) => `perks.${prefix}${i + 1}`);

export const standardPerks = (t) => [
  ...keys("std", 3).map((k) => ({ text: t(k), icon: "check" })),
  ...keys("no", 3).map((k) => ({ text: t(k), icon: "cross" })),
];

export const vipPerks = (t) => [
  ...keys("std", 3).map((k) => ({ text: t(k), icon: "check" })),
  ...keys("vip", 7).map((k) => ({ text: t(k), icon: "trophy" })),
];

export const goldPerks = (t) => keys("gold", 6).map((k) => ({ text: t(k), icon: "diamond" }));

export const buyBtnCls =
  "w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-base py-4 rounded-full transition-all duration-200 hover:shadow-[0_0_35px_rgba(255,106,0,0.35)] active:scale-[0.97] min-h-[56px]";
export const tierCardCls =
  "border border-white/10 bg-[#0D0E15] rounded-3xl p-6 sm:p-8 hover:border-[#FF0055]/60 hover:-translate-y-1 transition-all duration-300";
