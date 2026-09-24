import { Link } from "react-router-dom";
import { czk } from "@/api";
import { useT } from "@/i18n";
import { PerksList, vipPerks } from "./PerksList";

function VipAvailability({ soldOut, nextTier }) {
  const { t } = useT();
  if (soldOut) return t("tickets.soldOut");
  if (!nextTier) return t("tickets.limitedCapacity");
  return (
    <>
      {t("tickets.limitedCapacity")} · <span className="text-[#FFE600]">{t("tickets.nextRelease")} {czk(nextTier.price_czk)}</span>
    </>
  );
}

export function VipCard({ tier, nextTier, soldOut, onBuy }) {
  const { t, lp } = useT();
  const cardCls = soldOut
    ? "border-white/10 bg-[#0D0E15] opacity-50"
    : "border-white/10 bg-[#0D0E15] hover:border-[#FF0055]/60 hover:-translate-y-1";
  const btnCls = soldOut
    ? "bg-white/5 text-slate-600 cursor-not-allowed"
    : "bg-[#FF6A00] hover:bg-[#FF8534] text-white active:scale-[0.97] transition-all";
  return (
    <div data-testid={`ticket-tier-card-${tier.id}`} className={`mt-5 border rounded-3xl p-6 sm:p-8 transition-all duration-300 ${cardCls}`}>
      <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#C9A227] mb-3">{t("tickets.vip")}</p>
      <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="vip-price">{czk(tier.price_czk)}</p>
      <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-slate-500 mb-5" data-testid="vip-next-release">
        <VipAvailability soldOut={soldOut} nextTier={nextTier} />
      </p>
      <PerksList items={vipPerks(t)} testid="vip-card-perks-list" className="text-left" />
      <button
        data-testid={`buy-ticket-button-${tier.id}`}
        disabled={soldOut}
        onClick={onBuy}
        className={`w-full font-display font-bold uppercase text-base py-4 rounded-full transition-colors duration-300 min-h-[56px] ${btnCls}`}
      >
        {soldOut ? t("tickets.soldOut") : t("tickets.buy")}
      </button>
      <Link
        to={lp("/reserve")}
        data-testid="reserve-table-button"
        className="mt-3 w-full inline-flex items-center justify-center border border-[#C9A227] text-[#C9A227] hover:bg-[#C9A227] hover:text-black font-display font-bold uppercase text-sm py-3.5 rounded-full transition-all duration-200 active:scale-[0.97]"
      >
        {t("tickets.reserve")}
      </Link>
      <p data-testid="reserve-vip-required-small" className="mt-2 text-center font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#C9A227]/80">
        {t("tickets.vipRequired")}
      </p>
    </div>
  );
}
