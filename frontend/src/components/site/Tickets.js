import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Reveal } from "./Reveal";
import { useT } from "@/i18n";
import { CheckoutModal } from "./checkout/CheckoutModal";
import { PosterCarousel } from "./tickets/PosterCarousel";
import { GroupCard, SoldOutCard, StandardCard } from "./tickets/StandardCards";
import { VipCard } from "./tickets/VipCard";
import { GoldCard } from "./tickets/GoldCard";
import { isAvailable, pickTiers } from "./tickets/pickTiers";

export default function Tickets({ tiers = [], event, refCode }) {
  const [selected, setSelected] = useState(null);
  const { t } = useT();
  const { ga, activeGA, nextGA, group, vip, nextVip, vipOut, gold, goldOut } = pickTiers(tiers);

  return (
    <section id="tickets" className="px-4 sm:px-8 lg:px-16 py-12 lg:py-20" data-testid="tickets-section">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-14 items-start max-w-6xl mx-auto" data-testid="ticket-tiers">
        <Reveal className="lg:order-1">
          <PosterCarousel />
        </Reveal>

        <Reveal delay={0.05} className="lg:order-2">
          <div className="max-w-md mx-auto lg:mx-0">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-2">{t("tickets.eyebrow")}</p>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight mb-1">
              {event?.name || "Asia Takeover Festival"}
            </h2>
            <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-8" data-testid="room-labels">
              {event?.date_label || "27.09.2026"} <span className="text-[#FF0055]">•</span> {event?.venue || "DUPLEX"} {event?.city || "Prague"}
            </p>

            {activeGA ? (
              <StandardCard tier={activeGA} nextTier={nextGA} allGA={ga} isAvailable={isAvailable} onBuy={() => setSelected(activeGA)} />
            ) : (
              <SoldOutCard />
            )}
            {group && <GroupCard tier={group} onBuy={() => setSelected(group)} />}
            {vip && <VipCard tier={vip} nextTier={nextVip} soldOut={vipOut} onBuy={() => setSelected(vip)} />}
            {gold && <GoldCard tier={gold} soldOut={goldOut} onBuy={() => setSelected(gold)} />}

            <p className="text-sm text-slate-400 mt-6 leading-relaxed" data-testid="standard-vip-note">
              {t("tickets.wantTable")}
            </p>
            <p className="font-mono2 text-[10px] uppercase tracking-[0.15em] text-slate-600 mt-4 leading-relaxed" data-testid="ticket-no-refund-note">
              {t("tickets.noRefund")}
            </p>
          </div>
        </Reveal>
      </div>

      <AnimatePresence>
        {selected && event && (
          <CheckoutModal tier={selected} event={event} onClose={() => setSelected(null)} refCode={refCode} />
        )}
      </AnimatePresence>
    </section>
  );
}
