import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { api, formatError, czk } from "@/api";
import { buildOrderAttribution, marketingAllowed, trackEvent } from "@/lib/tracking";
import { Reveal } from "./Reveal";
import { useT } from "@/i18n";

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";

const POSTERS = [
  { src: "/assets/poster-festival.jpg", alt: "ASIA TAKEOVER FESTIVAL — official poster" },
  { src: "/assets/poster-floors.jpg", alt: "Floor map — KPOP Room, Mainstream Room, Saigon Room" },
  { src: "/assets/poster-lineup.jpg", alt: "Full line up — all 3 stages" },
];

function PosterCarousel() {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const { t } = useT();
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  return (
    <div className="lg:sticky lg:top-8">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl border border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-w-sm mx-auto cursor-grab active:cursor-grabbing"
        data-testid="poster-carousel"
      >
        {POSTERS.map((p, i) => (
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            className="w-full shrink-0 snap-center aspect-[4/5] object-cover select-none"
            data-testid={`poster-slide-${i + 1}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2.5 mt-4" data-testid="poster-dots">
        {POSTERS.map((p, i) => (
          <button
            key={p.src}
            onClick={() => go(i)}
            aria-label={`Poster ${i + 1}`}
            data-testid={`poster-dot-${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-7 bg-[#FF0055]" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
          />
        ))}
      </div>
      <p className="font-mono2 text-[10px] uppercase tracking-[0.3em] text-white/35 text-center mt-3 animate-pulse sm:hidden" data-testid="poster-swipe-hint">
        {t("tickets.swipe")} →
      </p>
    </div>
  );
}

function CheckoutModal({ tier, event, onClose, refCode }) {
  const { t } = useT();
  const isGroup = /group/i.test(tier.name);
  const isGold = /gold/i.test(tier.name);
  const displayName = isGold ? t("tickets.gold") : /vip/i.test(tier.name) ? t("tickets.vip") : isGroup ? `${t("tickets.group")} — 4× ${t("tickets.standard")}` : t("tickets.standard");
  const [step, setStep] = useState("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [qty, setQty] = useState(isGold ? 4 : 1);
  const [payment, setPayment] = useState(null);
  const [promoInput, setPromoInput] = useState(refCode || "");
  const [promoApplied, setPromoApplied] = useState(null);
  const left = Math.max(0, tier.capacity - (tier.sold || 0));
  const maxQty = Math.min(10, left || 10);
  const unitPrice = promoApplied
    ? (promoApplied.amount_off_czk
      ? Math.max(1, tier.price_czk - promoApplied.amount_off_czk)
      : Math.max(1, Math.round((tier.price_czk * (100 - promoApplied.percent)) / 100)))
    : tier.price_czk;
  const totalPrice = isGold ? 15000 + 3000 * Math.max(0, qty - 6) : unitPrice * qty;

  const applyPromo = async (codeOverride) => {
    const raw = (codeOverride ?? promoInput).trim();
    if (!raw) return;
    try {
      const r = await api.get(`/promo/validate?code=${encodeURIComponent(raw)}`);
      if (r.data.valid) {
        setPromoInput(raw.toUpperCase());
        setPromoApplied({
          code: raw.toUpperCase(),
          percent: r.data.percent_off,
          amount_off_czk: r.data.amount_off_czk || null,
        });
        toast.success(
          r.data.amount_off_czk
            ? `Discount applied — ${r.data.amount_off_czk} Kč off per ticket`
            : `Discount applied — ${r.data.percent_off}% off`
        );
      } else {
        setPromoApplied(null);
        toast.error(r.data.reason || "Invalid discount code");
      }
    } catch {
      toast.error("Could not validate the code — try again");
    }
  };

  const refAutoApplied = useRef(false);
  useEffect(() => {
    if (refCode && !refAutoApplied.current && !isGold) {
      refAutoApplied.current = true;
      applyPromo(refCode);
    }
  }, [refCode]);

  useEffect(() => {
    trackEvent("InitiateCheckout", {
      content_ids: [tier.id],
      content_type: "product",
      content_name: tier.name,
      value: tier.price_czk,
      currency: "CZK",
      num_items: 1,
    }, `ic_${tier.id}_${Date.now()}`);
  }, [tier]);

  useEffect(() => {
    if (step !== "payment" || !payment) return;
    let el = null;
    let cancelled = false;
    (async () => {
      try {
        const { initTeyaBlocks } = await import("@teyaproduct/teya-blocks-js");
        const teya = await initTeyaBlocks(payment.sessionToken, { locale: "cs-CZ" });
        if (cancelled) return;
        if (!teya) throw new Error("sdk init failed");
        el = teya.elements.createCheckout({
          onSuccess: () => window.location.assign(`/success?order_id=${payment.orderId}`),
          onError: () => toast.error("Payment failed — please try again."),
        });
        el.mount("#teya-checkout-container");
      } catch {
        if (!cancelled) toast.error("Payment form failed to load — please refresh and try again.");
      }
    })();
    return () => {
      cancelled = true;
      try { el && el.unmount(); } catch { /* noop */ }
    };
  }, [step, payment]);

  const pay = async (e) => {
    e.preventDefault();
    if (promoInput.trim() && !promoApplied) {
      toast.error(t("checkout.promoApplyFirst"));
      return;
    }
    setStep("processing");
    try {
      const r = await api.post("/orders/create", {
        tier_id: tier.id,
        quantity: qty,
        name,
        email,
        phone,
        promo_code: promoApplied ? promoApplied.code : undefined,
        attribution: buildOrderAttribution(),
        marketing_consent: marketingAllowed(),
      });
      if (r.data.mode === "teya" && r.data.session_token) {
        setPayment({ orderId: r.data.order_id, sessionToken: r.data.session_token });
        setStep("payment");
      } else {
        window.location.assign(r.data.payment_url);
      }
    } catch (e2) {
      toast.error(formatError(e2));
      setStep("form");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="checkout-modal">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        <button
          onClick={onClose}
          data-testid="checkout-close-button"
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {step === "form" && (
          <form onSubmit={pay}>
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{t("checkout.secure")}</p>
            <h3 className="font-display font-extrabold text-2xl uppercase mb-1">{displayName}</h3>
            <p className="text-slate-400 text-sm mb-6">
              {event.name} · {event.date_label} · {event.venue} {event.city}
            </p>
            <div className="space-y-4">
              <div>
                <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("checkout.fullName")}</label>
                <input data-testid="checkout-name-input" required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("checkout.namePlaceholder")} />
              </div>
              <div>
                <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("checkout.email")}</label>
                <input data-testid="checkout-email-input" required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div>
                <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("checkout.phone")}</label>
                <input data-testid="checkout-phone-input" required type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+420 …" />
              </div>
              {isGroup ? (
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("checkout.quantity")}</label>
                  <p className="font-mono2 text-sm text-slate-300 py-2.5" data-testid="checkout-group-note">{t("checkout.groupNote")}</p>
                </div>
              ) : isGold ? (
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("checkout.guestsGold")}</label>
                  <select
                    data-testid="checkout-quantity-select"
                    className={inputCls}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  >
                    {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n} — {czk(15000 + 3000 * Math.max(0, n - 6))}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("checkout.quantity")}</label>
                  <select
                    data-testid="checkout-quantity-select"
                    className={inputCls}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  >
                    {Array.from({ length: maxQty }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} {i > 0 ? t("checkout.ticketMany") : t("checkout.ticketOne")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {!isGold && (
            <div className="mt-6">
              <label className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-400">{t("checkout.discountCode")}</label>
              <div className="flex gap-2 mt-1.5">
                <input
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value); setPromoApplied(null); }}
                  placeholder={t("checkout.enterCode")}
                  data-testid="checkout-promo-input"
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00F0FF] uppercase placeholder:normal-case"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  data-testid="checkout-promo-apply"
                  className="font-mono2 text-xs uppercase tracking-[0.15em] border border-white/25 hover:border-[#00F0FF] hover:text-[#00F0FF] rounded-xl px-5 transition-colors"
                >
                  {t("checkout.apply")}
                </button>
              </div>
              {promoApplied && (
                <p className="font-mono2 text-[11px] text-[#00F0FF] mt-2" data-testid="promo-applied-note">
                  {promoApplied.amount_off_czk
                    ? `${promoApplied.code}: −${promoApplied.amount_off_czk} Kč / ${t("checkout.ticketOne")}`
                    : t("checkout.codeApplied").replace("{code}", promoApplied.code).replace("{percent}", promoApplied.percent).replace("{price}", czk(tier.price_czk * qty))}
                </p>
              )}
            </div>
            )}
            <button
              type="submit"
              data-testid="checkout-pay-button"
              className="mt-6 w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)]"
            >
              {t("checkout.continueToPayment")} — {czk(totalPrice)}
            </button>
            <p className="font-mono2 text-[11px] text-slate-500 mt-3 text-center">
              {t("checkout.secureNote")}
            </p>
            <p className="font-mono2 text-[10px] text-slate-600 mt-2 text-center">
              {t("checkout.termsNoteA")}{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">
                {t("checkout.termsNoteB")}
              </a>
              {t("checkout.termsNoteC")}
            </p>
          </form>
        )}

        {step === "processing" && (
          <div className="py-16 flex flex-col items-center gap-5" data-testid="checkout-processing">
            <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-[#FF6A00] animate-spin" />
            <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-slate-400">{t("checkout.creating")}</p>
          </div>
        )}

        {step === "payment" && payment && (
          <div data-testid="teya-embedded-checkout">
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{t("checkout.securePayment")}</p>
            <h3 className="font-display font-extrabold text-xl uppercase mb-1">
              {displayName} — {czk(totalPrice)}
            </h3>
            <p className="text-slate-400 text-sm mb-5">{isGroup ? t("checkout.groupTickets") : isGold ? `${qty} ${t("checkout.guestsWord")}` : `${qty} ${qty > 1 ? t("checkout.ticketMany") : t("checkout.ticketOne")}`} · {email}</p>
            <div id="teya-checkout-container" data-testid="teya-checkout-container" className="bg-white rounded-xl overflow-hidden min-h-[320px]" />
            <p className="font-mono2 text-[10px] text-slate-600 mt-3 text-center">
              {t("checkout.teyaNote")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Tickets({ tiers = [], event, refCode }) {
  const [selected, setSelected] = useState(null);
  const { t } = useT();
  const isAvailable = (x) => (x.sold || 0) < x.capacity;
  const ga = [...tiers].filter((x) => !x.name.toUpperCase().includes("VIP") && !x.name.toUpperCase().includes("GROUP")).sort((a, b) => a.price_czk - b.price_czk);
  const vipTiers = [...tiers].filter((x) => x.name.toUpperCase().includes("VIP") && !x.name.toUpperCase().includes("GOLD")).sort((a, b) => a.price_czk - b.price_czk);
  const groupTiers = [...tiers].filter((x) => x.name.toUpperCase().includes("GROUP")).sort((a, b) => a.price_czk - b.price_czk);
  const group = groupTiers.find(isAvailable);
  const goldTiers = [...tiers].filter((x) => x.name.toUpperCase().includes("GOLD"));
  const gold = goldTiers[0];
  const goldOut = gold ? !isAvailable(gold) : false;
  const activeGA = ga.find(isAvailable);
  const nextGA = activeGA ? ga[ga.indexOf(activeGA) + 1] : null;
  const vip = vipTiers.find(isAvailable) || vipTiers[vipTiers.length - 1];
  const nextVip = vip && isAvailable(vip) ? vipTiers[vipTiers.indexOf(vip) + 1] : null;
  const vipOut = vip ? !isAvailable(vip) : false;

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
              <div
                data-testid={`ticket-tier-card-${activeGA.id}`}
                className="border border-white/10 bg-[#0D0E15] rounded-3xl p-6 sm:p-8 hover:border-[#FF0055]/60 hover:-translate-y-1 transition-all duration-300"
              >
                <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{t("tickets.standard")}</p>
                <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="ga-price">{czk(activeGA.price_czk)}</p>
                <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600] mb-5" data-testid="next-release">
                  {nextGA ? `${t("tickets.nextRelease")} ${czk(nextGA.price_czk)}` : t("tickets.finalRelease")}
                </p>
                <ul className="space-y-2.5 text-sm text-slate-300 mb-6" data-testid="standard-card-perks-list">
                  {[t("perks.std1"), t("perks.std2"), t("perks.std3")].map((d) => (
                    <li key={d} className="flex items-start gap-2.5">
                      <Check size={15} className="text-green-400 mt-0.5 shrink-0" /> {d}
                    </li>
                  ))}
                  {[t("perks.no1"), t("perks.no2"), t("perks.no3")].map((d) => (
                    <li key={d} className="flex items-start gap-2.5">
                      <X size={15} className="text-[#FF0055] mt-0.5 shrink-0" /> {d}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid={`buy-ticket-button-${activeGA.id}`}
                  onClick={() => setSelected(activeGA)}
                  className="w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-base py-4 rounded-full transition-all duration-200 hover:shadow-[0_0_35px_rgba(255,106,0,0.35)] active:scale-[0.97] min-h-[56px]"
                >
                  {t("tickets.buy")}
                </button>
                <div className="mt-6 pt-5 border-t border-white/5" data-testid="price-progression">
                  <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-2">
                    {t("tickets.priceProgression")}
                  </p>
                  <p className="font-mono2 text-[11px] text-slate-500 tracking-[0.1em]">
                    {ga.map((t, i) => (
                      <span key={t.id}>
                        {i > 0 && <span className="text-slate-700 mx-1.5">→</span>}
                        <span className={!isAvailable(t) ? "line-through text-slate-700" : t.id === activeGA.id ? "text-white" : ""}>
                          {czk(t.price_czk)}
                        </span>
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-white/10 bg-[#0D0E15] rounded-3xl p-10 text-center" data-testid="ga-soldout-card">
                <p className="font-display font-extrabold text-xl uppercase text-slate-400">{t("tickets.soldOut")}</p>
              </div>
            )}

            {group && (
              <div
                data-testid={`ticket-tier-card-${group.id}`}
                className="mt-5 border border-white/10 bg-[#0D0E15] rounded-3xl p-6 sm:p-8 hover:border-[#FF0055]/60 hover:-translate-y-1 transition-all duration-300"
              >
                <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{t("tickets.group")}</p>
                <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="group-price">{czk(group.price_czk)}</p>
                <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600] mb-5" data-testid="group-per-person">
                  {t("tickets.groupPerPerson").replace("{price}", czk(Math.round(group.price_czk / 4)))}
                </p>
                <ul className="space-y-2.5 text-sm text-slate-300 mb-6" data-testid="group-perks-list">
                  {[t("perks.std1"), t("perks.std2"), t("perks.std3")].map((d) => (
                    <li key={d} className="flex items-start gap-2.5">
                      <Check size={15} className="text-green-400 mt-0.5 shrink-0" /> {d}
                    </li>
                  ))}
                  {[t("perks.no1"), t("perks.no2"), t("perks.no3")].map((d) => (
                    <li key={d} className="flex items-start gap-2.5">
                      <X size={15} className="text-[#FF0055] mt-0.5 shrink-0" /> {d}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid={`buy-ticket-button-${group.id}`}
                  onClick={() => setSelected(group)}
                  className="w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-base py-4 rounded-full transition-all duration-200 hover:shadow-[0_0_35px_rgba(255,106,0,0.35)] active:scale-[0.97] min-h-[56px]"
                >
                  {t("tickets.buyGroup")}
                </button>
              </div>
            )}

            {vip && (
              <div
                data-testid={`ticket-tier-card-${vip.id}`}
                className={`mt-5 border rounded-3xl p-6 sm:p-8 transition-all duration-300 ${
                  vipOut ? "border-white/10 bg-[#0D0E15] opacity-50" : "border-white/10 bg-[#0D0E15] hover:border-[#FF0055]/60 hover:-translate-y-1"
                }`}
              >
                <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#C9A227] mb-3">{t("tickets.vip")}</p>
                <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="vip-price">{czk(vip.price_czk)}</p>
                <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-slate-500 mb-5" data-testid="vip-next-release">
                  {vipOut ? t("tickets.soldOut") : nextVip ? (
                    <>{t("tickets.limitedCapacity")} · <span className="text-[#FFE600]">{t("tickets.nextRelease")} {czk(nextVip.price_czk)}</span></>
                  ) : t("tickets.limitedCapacity")}
                </p>
                <ul className="text-left space-y-2.5 text-sm text-slate-300 mb-6" data-testid="vip-card-perks-list">
                  {[t("perks.std1"), t("perks.std2"), t("perks.std3")].map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <Check size={15} className="text-green-400 mt-0.5 shrink-0" /> {p}
                    </li>
                  ))}
                  {[t("perks.vip1"), t("perks.vip2"), t("perks.vip3"), t("perks.vip4"), t("perks.vip5"), t("perks.vip6"), t("perks.vip7")].map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0 text-sm leading-none">🏆</span> {p}
                    </li>
                  ))}
                </ul>
                <button
                  data-testid={`buy-ticket-button-${vip.id}`}
                  disabled={vipOut}
                  onClick={() => setSelected(vip)}
                  className={`w-full font-display font-bold uppercase text-base py-4 rounded-full transition-colors duration-300 min-h-[56px] ${
                    vipOut
                      ? "bg-white/5 text-slate-600 cursor-not-allowed"
                      : "bg-[#FF6A00] hover:bg-[#FF8534] text-white active:scale-[0.97] transition-all"
                  }`}
                >
                  {vipOut ? t("tickets.soldOut") : t("tickets.buy")}
                </button>
                <Link
                  to="/reserve"
                  data-testid="reserve-table-button"
                  className="mt-3 w-full inline-flex items-center justify-center border border-[#C9A227] text-[#C9A227] hover:bg-[#C9A227] hover:text-black font-display font-bold uppercase text-sm py-3.5 rounded-full transition-all duration-200 active:scale-[0.97]"
                >
                  {t("tickets.reserve")}
                </Link>
                <p
                  data-testid="reserve-vip-required-small"
                  className="mt-2 text-center font-mono2 text-[10px] uppercase tracking-[0.2em] text-[#C9A227]/80"
                >
                  {t("tickets.vipRequired")}
                </p>
              </div>
            )}

            {gold && (
              <div
                data-testid={`ticket-tier-card-${gold.id}`}
                className={`mt-5 rounded-3xl p-[1.5px] ${goldOut ? "opacity-60" : ""}`}
                style={{ background: "linear-gradient(135deg, #8a6a1f, #f5d76e 30%, #b8912f 55%, #f9e7a0 75%, #8a6a1f)" }}
              >
                <div className="rounded-3xl bg-[#0D0E15] p-6 sm:p-8 shadow-[0_0_50px_rgba(201,162,39,0.12)]">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#E7C55A]">{t("tickets.gold")}</p>
                    <span
                      data-testid="gold-badge"
                      className="whitespace-nowrap font-mono2 text-[10px] font-bold uppercase tracking-[0.15em] text-black rounded-full px-3 py-1"
                      style={{ background: "linear-gradient(90deg, #d4af37, #f5d76e)" }}
                    >
                      {t("tickets.goldBadge")}
                    </span>
                  </div>
                  <p
                    className="font-display font-black text-4xl sm:text-5xl mb-1 text-transparent bg-clip-text"
                    style={{ backgroundImage: "linear-gradient(90deg, #d4af37, #f5d76e, #b8912f)" }}
                    data-testid="gold-price"
                  >
                    {czk(gold.price_czk)}
                  </p>
                  <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#C9A227] mb-4">{t("tickets.goldPerTable")}</p>
                  <p className="font-mono2 text-xs uppercase tracking-[0.12em] text-slate-300 mb-1" data-testid="gold-upto6">{t("tickets.goldUpTo6")}</p>
                  <p className="font-mono2 text-[10px] uppercase tracking-[0.12em] text-slate-500 mb-5">{t("tickets.goldAdditional")}</p>
                  <ul className="text-left space-y-2.5 text-sm text-slate-300 mb-6" data-testid="gold-perks-list">
                    {[t("perks.gold1"), t("perks.gold2"), t("perks.gold3"), t("perks.gold4"), t("perks.gold5"), t("perks.gold6")].map((p) => (
                      <li key={p} className="flex items-start gap-2.5">
                        <span className="mt-0.5 shrink-0 text-sm leading-none text-[#E7C55A]">◆</span> {p}
                      </li>
                    ))}
                  </ul>
                  <button
                    data-testid={`buy-ticket-button-${gold.id}`}
                    disabled={goldOut}
                    onClick={() => setSelected(gold)}
                    className={`w-full font-display font-bold uppercase text-base py-4 rounded-full transition-all duration-200 active:scale-[0.97] min-h-[56px] ${
                      goldOut ? "bg-white/5 text-slate-600 cursor-not-allowed" : "text-black hover:shadow-[0_0_35px_rgba(212,175,55,0.45)]"
                    }`}
                    style={goldOut ? undefined : { background: "linear-gradient(90deg, #b8912f, #f5d76e 50%, #d4af37)" }}
                  >
                    {goldOut ? t("tickets.soldOut") : t("tickets.buyGold")}
                  </button>
                </div>
              </div>
            )}

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
