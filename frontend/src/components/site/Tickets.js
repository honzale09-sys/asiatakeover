import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { api, formatError, czk } from "@/api";
import { buildOrderAttribution, marketingAllowed, trackEvent } from "@/lib/tracking";
import { Reveal } from "./Reveal";

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";

function CheckoutModal({ tier, event, onClose }) {
  const displayName = /vip/i.test(tier.name) ? "VIP Table Ticket" : "Standard Ticket";
  const [step, setStep] = useState("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState(null);
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState(null);
  const left = Math.max(0, tier.capacity - (tier.sold || 0));
  const maxQty = Math.min(10, left || 10);
  const unitPrice = promoApplied
    ? Math.max(1, Math.round((tier.price_czk * (100 - promoApplied.percent)) / 100))
    : tier.price_czk;
  const totalPrice = unitPrice * qty;

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    try {
      const r = await api.get(`/promo/validate?code=${encodeURIComponent(promoInput.trim())}`);
      if (r.data.valid) {
        setPromoApplied({ code: promoInput.trim().toUpperCase(), percent: r.data.percent_off });
        toast.success(`Discount applied — ${r.data.percent_off}% off`);
      } else {
        setPromoApplied(null);
        toast.error("Invalid discount code");
      }
    } catch {
      toast.error("Could not validate the code — try again");
    }
  };

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
    setStep("processing");
    try {
      const r = await api.post("/orders/create", {
        tier_id: tier.id,
        quantity: qty,
        name,
        email,
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
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2">Secure checkout</p>
            <h3 className="font-display font-extrabold text-2xl uppercase mb-1">{displayName}</h3>
            <p className="text-slate-400 text-sm mb-6">
              {event.name} · {event.date_label} · {event.venue} {event.city}
            </p>
            <div className="space-y-4">
              <div>
                <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Full name</label>
                <input data-testid="checkout-name-input" required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Email</label>
                <input data-testid="checkout-email-input" required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
              <div>
                <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Quantity</label>
                <select
                  data-testid="checkout-quantity-select"
                  className={inputCls}
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                >
                  {Array.from({ length: maxQty }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} ticket{i > 0 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6">
              <label className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-400">Discount code</label>
              <div className="flex gap-2 mt-1.5">
                <input
                  value={promoInput}
                  onChange={(e) => { setPromoInput(e.target.value); setPromoApplied(null); }}
                  placeholder="Enter code"
                  data-testid="checkout-promo-input"
                  className="flex-1 bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00F0FF] uppercase placeholder:normal-case"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  data-testid="checkout-promo-apply"
                  className="font-mono2 text-xs uppercase tracking-[0.15em] border border-white/25 hover:border-[#00F0FF] hover:text-[#00F0FF] rounded-xl px-5 transition-colors"
                >
                  Apply
                </button>
              </div>
              {promoApplied && (
                <p className="font-mono2 text-[11px] text-[#00F0FF] mt-2" data-testid="promo-applied-note">
                  Code {promoApplied.code} applied: −{promoApplied.percent}% (list price {czk(tier.price_czk * qty)})
                </p>
              )}
            </div>
            <button
              type="submit"
              data-testid="checkout-pay-button"
              className="mt-6 w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)]"
            >
              Continue to Payment — {czk(totalPrice)}
            </button>
            <p className="font-mono2 text-[11px] text-slate-500 mt-3 text-center">
              Secure card payment by Teya, directly on this page. Tickets are issued only after the payment is confirmed.
            </p>
            <p className="font-mono2 text-[10px] text-slate-600 mt-2 text-center">
              By continuing you agree to our{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">
                Terms & Conditions
              </a>
              . Tickets are non-refundable and freely transferable.
            </p>
          </form>
        )}

        {step === "processing" && (
          <div className="py-16 flex flex-col items-center gap-5" data-testid="checkout-processing">
            <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-[#FF6A00] animate-spin" />
            <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-slate-400">Creating your order…</p>
          </div>
        )}

        {step === "payment" && payment && (
          <div data-testid="teya-embedded-checkout">
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2">Secure payment</p>
            <h3 className="font-display font-extrabold text-xl uppercase mb-1">
              {displayName} — {czk(totalPrice)}
            </h3>
            <p className="text-slate-400 text-sm mb-5">{qty} ticket{qty > 1 ? "s" : ""} · {email}</p>
            <div id="teya-checkout-container" data-testid="teya-checkout-container" className="bg-white rounded-xl overflow-hidden min-h-[320px]" />
            <p className="font-mono2 text-[10px] text-slate-600 mt-3 text-center">
              Payments are processed by Teya. Tickets with QR codes arrive by email right after the payment is confirmed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Tickets({ tiers = [], event }) {
  const [selected, setSelected] = useState(null);
  const isAvailable = (t) => (t.sold || 0) < t.capacity;
  const ga = [...tiers].filter((t) => !t.name.toUpperCase().includes("VIP")).sort((a, b) => a.price_czk - b.price_czk);
  const vip = [...tiers].filter((t) => t.name.toUpperCase().includes("VIP")).sort((a, b) => a.price_czk - b.price_czk)[0];
  const soldOutGA = ga.filter((t) => !isAvailable(t));
  const activeGA = ga.find(isAvailable);
  const nextGA = activeGA ? ga[ga.indexOf(activeGA) + 1] : null;
  const vipOut = vip ? !isAvailable(vip) : false;

  return (
    <section id="tickets" className="px-4 sm:px-8 lg:px-16 py-12 lg:py-20" data-testid="tickets-section">
      <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,400px)_1fr] lg:gap-12 items-start" data-testid="ticket-tiers">
        <Reveal className="lg:order-2">
          <img
            src="/assets/poster-festival.jpg"
            alt={`${event?.name || "ASIA TAKEOVER FESTIVAL"} — 27.09.2026, DUPLEX Prague`}
            className="w-full max-w-sm mx-auto rounded-2xl border border-white/10 lg:sticky lg:top-8"
            data-testid="tickets-event-poster"
          />
        </Reveal>

        <Reveal delay={0.05} className="lg:order-3">
          <div className="max-w-md mx-auto lg:mx-0">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-2">Tickets</p>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight mb-1">
              {event?.name || "Asia Takeover Festival"}
            </h2>
            <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-8" data-testid="room-labels">
              {event?.date_label || "27.09.2026"} <span className="text-[#FF0055]">•</span> {event?.venue || "DUPLEX"} {event?.city || "Prague"}
            </p>

            {soldOutGA.map((t) => (
              <div
                key={t.id}
                data-testid={`soldout-row-${t.id}`}
                className="flex items-center justify-between border border-white/5 bg-white/[0.02] rounded-lg px-4 py-2.5 mb-2 opacity-45"
              >
                <span className="font-mono2 text-xs uppercase tracking-[0.15em] text-slate-500">{t.name}</span>
                <span className="font-mono2 text-xs text-slate-500">{czk(t.price_czk)}</span>
                <span className="font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 border border-white/10 rounded-full px-3 py-1">Sold out</span>
              </div>
            ))}

            {activeGA ? (
              <div
                data-testid={`ticket-tier-card-${activeGA.id}`}
                className="relative border border-[#FF0055]/50 bg-[#0D0E15] rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(255,0,85,0.18)] hover:shadow-[0_0_70px_rgba(255,0,85,0.28)] hover:border-[#FF0055]/80 transition-all duration-300"
              >
                <span className="absolute -top-3 left-6 bg-[#FF0055] font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full" data-testid="most-popular-badge">
                  Selling now
                </span>
                <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-3">Standard Ticket</p>
                <p className="font-display font-black text-4xl sm:text-5xl mb-4" data-testid="ga-price">{czk(activeGA.price_czk)}</p>
                <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600] mb-6" data-testid="next-release">
                  {nextGA ? `Next release: ${czk(nextGA.price_czk)}` : "Final online ticket release"}
                </p>
                <button
                  data-testid={`buy-ticket-button-${activeGA.id}`}
                  onClick={() => setSelected(activeGA)}
                  className="w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-base py-4 rounded-full transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)] min-h-[56px]"
                >
                  Buy Ticket
                </button>
                <div className="mt-6 pt-5 border-t border-white/5" data-testid="price-progression">
                  <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-2">
                    Price increases as each release sells out
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
                <p className="font-display font-extrabold text-xl uppercase text-slate-400">All releases sold out</p>
                <p className="text-slate-500 text-sm mt-2">Follow us for last-minute announcements.</p>
              </div>
            )}

            {vip && (
              <div
                data-testid={`ticket-tier-card-${vip.id}`}
                className={`mt-5 relative border rounded-3xl p-6 sm:p-7 transition-all duration-300 ${
                  vipOut
                    ? "border-white/5 bg-white/[0.02] opacity-50"
                    : "border-[#C9A227]/40 bg-[#0D0E15] hover:border-[#C9A227]/70 hover:shadow-[0_0_40px_rgba(201,162,39,0.15)]"
                }`}
              >
                {vipOut && (
                  <span className="absolute -top-3 left-6 bg-white/10 font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full text-slate-400" data-testid="vip-soldout-badge">
                    Sold out
                  </span>
                )}
                <div className="flex items-center justify-between gap-4 mb-5">
                  <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#C9A227]">VIP Table Ticket</p>
                  <p className="font-display font-black text-2xl sm:text-3xl" data-testid="vip-price">{czk(vip.price_czk)}</p>
                </div>
                <button
                  data-testid={`buy-ticket-button-${vip.id}`}
                  disabled={vipOut}
                  onClick={() => setSelected(vip)}
                  className={`w-full font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 min-h-[56px] ${
                    vipOut
                      ? "bg-white/5 text-slate-600 cursor-not-allowed"
                      : "border border-[#C9A227] text-[#C9A227] hover:bg-[#C9A227] hover:text-black"
                  }`}
                >
                  {vipOut ? "Sold Out" : "Buy VIP"}
                </button>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal className="lg:order-1">
          <div className="max-w-md mx-auto lg:mx-0" data-testid="ticket-details">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-4">Details</p>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight mb-6">
              What your ticket <span className="text-[#FF0055]">includes</span>
            </h2>
            <ul className="space-y-3 text-sm text-slate-300">
              {[
                "Access to all 3 stages",
                "Standing and dance floor access",
                "Access to all public bars",
                "No access to VIP areas",
              ].map((d) => (
                <li key={d} className="flex items-start gap-2.5">
                  <Check size={15} className="text-[#00F0FF] mt-0.5 shrink-0" /> {d}
                </li>
              ))}
            </ul>
            <p className="font-mono2 text-[10px] uppercase tracking-[0.15em] text-slate-600 mt-6 leading-relaxed" data-testid="ticket-no-refund-note">
              Tickets are non-refundable · full refund only if the event is cancelled by the organizer
            </p>
            {vip && (
              <div className="mt-8 pt-6 border-t border-white/5">
                <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#C9A227] mb-4">VIP Table Ticket</p>
                <ul className="space-y-2.5 text-sm text-slate-300" data-testid="vip-perks-list">
                  {[
                    "Access to all 3 stages",
                    "Priority fast lane",
                    "Access to all VIP areas",
                    "VIP Toilets",
                    "Special Gift 🎈",
                    "Bottle service available",
                    "7th floor K-POP stage balcony access with tables",
                  ].map((p) => (
                    <li key={p} className="flex items-start gap-2.5">
                      <Check size={15} className="text-[#C9A227] mt-0.5 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      <AnimatePresence>
        {selected && event && (
          <CheckoutModal tier={selected} event={event} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
