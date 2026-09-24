import { czk } from "@/api";
import { useT } from "@/i18n";
import { PerksList, buyBtnCls, standardPerks, tierCardCls } from "./PerksList";

function priceCls(tier, activeId, isAvailable) {
  if (!isAvailable(tier)) return "line-through text-slate-700";
  return tier.id === activeId ? "text-white" : "";
}

export function StandardCard({ tier, nextTier, allGA, isAvailable, onBuy }) {
  const { t } = useT();
  return (
    <div data-testid={`ticket-tier-card-${tier.id}`} className={tierCardCls}>
      <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{t("tickets.standard")}</p>
      <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="ga-price">{czk(tier.price_czk)}</p>
      <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600] mb-5" data-testid="next-release">
        {nextTier ? `${t("tickets.nextRelease")} ${czk(nextTier.price_czk)}` : t("tickets.finalRelease")}
      </p>
      <PerksList items={standardPerks(t)} testid="standard-card-perks-list" />
      <button data-testid={`buy-ticket-button-${tier.id}`} onClick={onBuy} className={buyBtnCls}>
        {t("tickets.buy")}
      </button>
      <div className="mt-6 pt-5 border-t border-white/5" data-testid="price-progression">
        <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-2">{t("tickets.priceProgression")}</p>
        <p className="font-mono2 text-[11px] text-slate-500 tracking-[0.1em]">
          {allGA.map((x, i) => (
            <span key={x.id}>
              {i > 0 && <span className="text-slate-700 mx-1.5">→</span>}
              <span className={priceCls(x, tier.id, isAvailable)}>{czk(x.price_czk)}</span>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

export function SoldOutCard() {
  const { t } = useT();
  return (
    <div className="border border-white/10 bg-[#0D0E15] rounded-3xl p-10 text-center" data-testid="ga-soldout-card">
      <p className="font-display font-extrabold text-xl uppercase text-slate-400">{t("tickets.soldOut")}</p>
    </div>
  );
}

export function GroupCard({ tier, onBuy }) {
  const { t } = useT();
  return (
    <div data-testid={`ticket-tier-card-${tier.id}`} className={`mt-5 ${tierCardCls}`}>
      <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{t("tickets.group")}</p>
      <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="group-price">{czk(tier.price_czk)}</p>
      <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600] mb-5" data-testid="group-per-person">
        {t("tickets.groupPerPerson").replace("{price}", czk(Math.round(tier.price_czk / 4)))}
      </p>
      <PerksList items={standardPerks(t)} testid="group-perks-list" />
      <button data-testid={`buy-ticket-button-${tier.id}`} onClick={onBuy} className={buyBtnCls}>
        {t("tickets.buyGroup")}
      </button>
    </div>
  );
}
