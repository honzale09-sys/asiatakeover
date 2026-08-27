import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { api, formatError, czk } from "@/api";
import { buildOrderAttribution, marketingAllowed, trackEvent } from "@/lib/tracking";
import { Reveal, SectionHead } from "./Reveal";

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
  const sorted = [...tiers].sort((a, b) => a.price_czk - b.price_czk);

  return (
    <section id="tickets" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28" data-testid="tickets-section">
      <Reveal>
        <SectionHead kicker="03 / The Entry" title="Choose Your" accent="Weapon" />
      </Reveal>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5" data-testid="ticket-tiers">
        {sorted.map((t, i) => {
          const left = t.capacity - (t.sold || 0);
          const soldOut = left <= 0;
          const featured = t.name.includes("VIP Sky");
          return (
            <Reveal key={t.id} delay={i * 0.08}>
              <div
                data-testid={`ticket-tier-card-${t.id}`}
                className={`relative h-full flex flex-col border rounded-3xl p-6 transition-colors duration-300 ${
                  featured
                    ? "border-[#FF0055] bg-[#FF0055]/10 neon-shadow"
                    : "border-white/10 bg-[#0D0E15] hover:border-white/30"
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 left-6 bg-[#FF0055] font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                    Most Wanted
                  </span>
                )}
                <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{t.name}</p>
                <p className="font-display font-black text-3xl mb-1">{czk(t.price_czk)}</p>
                <p className="text-slate-400 text-sm mb-5">{t.description}</p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {(t.perks || []).map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm text-slate-300">
                      <Check size={15} className="text-[#FFE600] mt-0.5 shrink-0" /> {p}
                    </li>
                  ))}
                </ul>
                <p className={`font-mono2 text-[11px] uppercase tracking-[0.15em] mb-3 ${left < 60 ? "text-[#FF0055]" : "text-slate-500"}`}>
                  {soldOut ? "Sold out" : `${left} left`}
                </p>
                <button
                  data-testid={`buy-ticket-button-${t.id}`}
                  disabled={soldOut}
                  onClick={() => setSelected(t)}
                  className={`w-full font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors duration-300 ${
                    soldOut
                      ? "bg-white/5 text-slate-600 cursor-not-allowed"
                      : "bg-[#FF0055] hover:bg-[#FFE600] hover:text-black text-white"
                  }`}
                >
                  {soldOut ? "Sold Out" : "Get Ticket"}
                </button>
              </div>
            </Reveal>
          );
        })}
      </div>
      <AnimatePresence>
        {selected && event && (
          <CheckoutModal tier={selected} event={event} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}
