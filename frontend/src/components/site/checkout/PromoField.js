import { czk } from "@/api";
import { useT } from "@/i18n";

export function PromoField({ promoInput, setPromoInput, promoApplied, applyPromo, listPrice, qty }) {
  const { t } = useT();
  const appliedNote = promoApplied?.amount_off_czk
    ? `${promoApplied.code}: −${promoApplied.amount_off_czk} Kč / ${t("checkout.ticketOne")}`
    : promoApplied &&
      t("checkout.codeApplied")
        .replace("{code}", promoApplied.code)
        .replace("{percent}", promoApplied.percent)
        .replace("{price}", czk(listPrice * qty));
  return (
    <div className="mt-6">
      <label className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t("checkout.discountCode")}</label>
      <div className="flex gap-2 mt-1.5">
        <input
          value={promoInput}
          onChange={(e) => setPromoInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyPromo();
            }
          }}
          placeholder={t("checkout.enterCode")}
          data-testid="checkout-promo-input"
          className="flex-1 bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00F0FF] uppercase placeholder:normal-case"
        />
        <button
          type="button"
          onClick={() => applyPromo()}
          data-testid="checkout-promo-apply"
          className="font-mono2 text-xs uppercase tracking-[0.15em] border border-white/25 hover:border-[#00F0FF] hover:text-[#00F0FF] rounded-xl px-5 transition-colors"
        >
          {t("checkout.apply")}
        </button>
      </div>
      {promoApplied && (
        <p className="font-mono2 text-[11px] text-[#00F0FF] mt-2" data-testid="promo-applied-note">
          {appliedNote}
        </p>
      )}
    </div>
  );
}
