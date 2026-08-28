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
  const [step, setStep] = useState("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [qty, setQty] = useState(1);
  const left = Math.max(0, tier.capacity - (tier.sold || 0));
  const maxQty = Math.min(10, left || 10);

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

  const pay = async (e) => {
    e.preventDefault();
    setStep("processing");
    try {
      const r = await api.post("/orders/create", {
        tier_id: tier.id,
        quantity: qty,
        name,
        email,
        attribution: buildOrderAttribution(),
        marketing_consent: marketingAllowed(),
      });
      window.location.assign(r.data.payment_url);
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
            <h3 className="font-display font-extrabold text-2xl uppercase mb-1">{tier.name}</h3>
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
            <button
              type="submit"
              data-testid="checkout-pay-button"
              className="mt-6 w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)]"
            >
              Continue to Payment — {czk(tier.price_czk * qty)}
            </button>
            <p className="font-mono2 text-[11px] text-slate-500 mt-3 text-center">
              You'll be redirected to the payment gateway. Tickets are issued only after the payment is confirmed.
            </p>
          </form>
        )}

        {step === "processing" && (
          <div className="py-16 flex flex-col items-center gap-5" data-testid="checkout-processing">
            <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-[#FF6A00] animate-spin" />
            <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-slate-400">Creating your order…</p>
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
    <section id="tickets" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28" data-testid="tickets-section">
      <Reveal>
        <div className="mb-12 lg:mb-16">
          <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-4">Tickets</p>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight leading-tight">
            Choose Your <span className="text-[#FF0055]">Ticket</span>
          </h2>
          <p className="text-slate-400 text-sm sm:text-base mt-4">One ticket gives you access to all three rooms.</p>
          <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mt-3" data-testid="room-labels">
            Seoul Room <span className="text-[#FF0055]">•</span> Mainstream Room <span className="text-[#FF0055]">•</span> Gangshii Room
          </p>
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-5 gap-6 lg:gap-8 items-start" data-testid="ticket-tiers">
        <Reveal className="lg:col-span-3">
          <div>
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
                className="relative border border-[#FF0055]/50 bg-[#0D0E15] rounded-3xl p-7 sm:p-10 shadow-[0_0_50px_rgba(255,0,85,0.18)] hover:shadow-[0_0_70px_rgba(255,0,85,0.28)] hover:border-[#FF0055]/80 transition-all duration-300"
              >
                <span className="absolute -top-3 left-7 bg-[#FF0055] font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full" data-testid="most-popular-badge">
                  Most Popular
                </span>
                <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{activeGA.name}</p>
                <p className="font-display font-black text-5xl sm:text-6xl mb-5" data-testid="ga-price">{czk(activeGA.price_czk)}</p>
                <p className="text-slate-300 text-sm sm:text-base">Access to all 3 rooms</p>
                <p className="text-slate-500 text-sm mt-1.5">Limited availability</p>
                <p className="font-mono2 text-xs uppercase tracking-[0.15em] text-[#FFE600] mt-4" data-testid="next-release">
                  {nextGA ? `Next release: ${czk(nextGA.price_czk)}` : "Final online ticket release"}
                </p>
                <button
                  data-testid={`buy-ticket-button-${activeGA.id}`}
                  onClick={() => setSelected(activeGA)}
                  className="mt-7 w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-base py-4 rounded-full transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)] min-h-[56px]"
                >
                  Buy Ticket
                </button>
                <div className="mt-7 pt-5 border-t border-white/5" data-testid="price-progression">
                  <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-600 mb-2">
                    Ticket prices increase as each release sells out
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
          </div>
        </Reveal>

        {vip && (
          <Reveal delay={0.1} className="lg:col-span-2">
            <div
              data-testid={`ticket-tier-card-${vip.id}`}
              className={`relative border rounded-3xl p-7 sm:p-8 transition-all duration-300 ${
                vipOut
                  ? "border-white/5 bg-white/[0.02] opacity-50"
                  : "border-[#C9A227]/40 bg-[#0D0E15] hover:border-[#C9A227]/70 hover:shadow-[0_0_40px_rgba(201,162,39,0.15)]"
              }`}
            >
              {vipOut && (
                <span className="absolute -top-3 left-7 bg-white/10 font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full text-slate-400" data-testid="vip-soldout-badge">
                  Sold out
                </span>
              )}
              <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#C9A227] mb-3">{vip.name}</p>
              <p className="font-display font-black text-4xl sm:text-5xl mb-5" data-testid="vip-price">{czk(vip.price_czk)}</p>
              <ul className="space-y-2.5 mb-4">
                {(vip.perks || []).map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check size={15} className="text-[#C9A227] mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
              <p className="text-slate-500 text-sm mb-6">Limited VIP capacity</p>
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
          </Reveal>
        )}
      </div>

      <AnimatePresence>
        {selected && event && (
          <CheckoutModal tier={selected} event={event} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
