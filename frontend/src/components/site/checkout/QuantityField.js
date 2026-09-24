import { czk } from "@/api";
import { useT } from "@/i18n";
import { GOLD_GUEST_OPTIONS, goldTotal } from "./pricing";

export const checkoutInputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";
export const checkoutLabelCls = "font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5";

export function QuantityField({ kind, qty, setQty, maxQty }) {
  const { t } = useT();
  if (kind === "group") {
    return (
      <div>
        <label className={checkoutLabelCls}>{t("checkout.quantity")}</label>
        <p className="font-mono2 text-sm text-slate-300 py-2.5" data-testid="checkout-group-note">{t("checkout.groupNote")}</p>
      </div>
    );
  }
  const isGold = kind === "gold";
  const options = isGold
    ? GOLD_GUEST_OPTIONS.map((n) => ({ value: n, label: `${n} — ${czk(goldTotal(n))}` }))
    : Array.from({ length: maxQty }, (_, i) => ({ value: i + 1, label: `${i + 1} ${i > 0 ? t("checkout.ticketMany") : t("checkout.ticketOne")}` }));
  return (
    <div>
      <label className={checkoutLabelCls}>{isGold ? t("checkout.guestsGold") : t("checkout.quantity")}</label>
      <select data-testid="checkout-quantity-select" className={checkoutInputCls} value={qty} onChange={(e) => setQty(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
