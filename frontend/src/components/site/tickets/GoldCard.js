import { useT } from "@/i18n";
import { PerksList, goldPerks } from "./PerksList";

const GOLD_FRAME = "linear-gradient(135deg, #8a6a1f, #f5d76e 30%, #b8912f 55%, #f9e7a0 75%, #8a6a1f)";
const GOLD_BADGE = "linear-gradient(90deg, #d4af37, #f5d76e)";
const GOLD_TEXT = "linear-gradient(90deg, #d4af37, #f5d76e, #b8912f)";
const GOLD_BUTTON = "linear-gradient(90deg, #b8912f, #f5d76e 50%, #d4af37)";

export function GoldCard({ tier, soldOut, onBuy }) {
  const { t } = useT();
  const btnCls = soldOut ? "bg-white/5 text-slate-600 cursor-not-allowed" : "text-black hover:shadow-[0_0_35px_rgba(212,175,55,0.45)]";
  return (
    <div data-testid={`ticket-tier-card-${tier.id}`} className={`mt-5 rounded-3xl p-[1.5px] ${soldOut ? "opacity-60" : ""}`} style={{ background: GOLD_FRAME }}>
      <div className="rounded-3xl bg-[#0D0E15] p-6 sm:p-8 shadow-[0_0_50px_rgba(201,162,39,0.12)]">
        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#E7C55A]">{t("tickets.gold")}</p>
          <span
            data-testid="gold-badge"
            className="whitespace-nowrap font-mono2 text-[10px] font-bold uppercase tracking-[0.15em] text-black rounded-full px-3 py-1"
            style={{ background: GOLD_BADGE }}
          >
            {t("tickets.goldBadge")}
          </span>
        </div>
        <p className="font-display font-black text-2xl sm:text-3xl mb-5 text-transparent bg-clip-text leading-snug" style={{ backgroundImage: GOLD_TEXT }} data-testid="gold-price">
          {t("tickets.goldFee")}
        </p>
        <PerksList items={goldPerks(t)} testid="gold-perks-list" className="text-left" />
        <button
          data-testid={`buy-ticket-button-${tier.id}`}
          disabled={soldOut}
          onClick={onBuy}
          className={`w-full font-display font-bold uppercase text-base py-4 rounded-full transition-all duration-200 active:scale-[0.97] min-h-[56px] ${btnCls}`}
          style={soldOut ? undefined : { background: GOLD_BUTTON }}
        >
          {soldOut ? t("tickets.soldOut") : t("tickets.buyGold")}
        </button>
      </div>
    </div>
  );
}
