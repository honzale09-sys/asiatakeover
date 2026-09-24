import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { api, formatError } from "@/api";
import { buildOrderAttribution, marketingAllowed, trackEvent } from "@/lib/tracking";
import { useT } from "@/i18n";
import { CheckoutForm } from "./CheckoutForm";
import { ProcessingStep, TeyaPaymentStep } from "./TeyaPaymentStep";
import { usePromo } from "./usePromo";
import { checkoutDisplayName, discountedUnitPrice, goldTotal, quantityLabel, tierKind } from "./pricing";

export function CheckoutModal({ tier, event, onClose, refCode }) {
  const { t } = useT();
  const kind = tierKind(tier);
  const displayName = checkoutDisplayName(kind, t);
  const [step, setStep] = useState("form");
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [qty, setQty] = useState(kind === "gold" ? 4 : 1);
  const [payment, setPayment] = useState(null);
  const promo = usePromo(refCode);
  const { promoInput, promoApplied, applyPromo } = promo;

  const left = Math.max(0, tier.capacity - (tier.sold || 0));
  const maxQty = Math.min(10, left || 10);
  const unitPrice = discountedUnitPrice(tier.price_czk, promoApplied);
  const totalPrice = kind === "gold" ? goldTotal(qty) : unitPrice * qty;

  const refAutoApplied = useRef(false);
  useEffect(() => {
    if (refCode && !refAutoApplied.current && kind !== "gold") {
      refAutoApplied.current = true;
      applyPromo(refCode);
    }
  }, [refCode, kind, applyPromo]);

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
    if (promoInput.trim() && !promoApplied) {
      toast.error(t("checkout.promoApplyFirst"));
      return;
    }
    setStep("processing");
    try {
      const r = await api.post("/orders/create", {
        tier_id: tier.id,
        quantity: qty,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
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
        <button onClick={onClose} data-testid="checkout-close-button" className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
        {step === "form" && (
          <CheckoutForm
            kind={kind}
            displayName={displayName}
            event={event}
            buyer={buyer}
            setBuyer={setBuyer}
            qty={qty}
            setQty={setQty}
            maxQty={maxQty}
            promo={promo}
            listPrice={tier.price_czk}
            totalPrice={totalPrice}
            onSubmit={pay}
          />
        )}
        {step === "processing" && <ProcessingStep text={t("checkout.creating")} />}
        {step === "payment" && payment && (
          <TeyaPaymentStep
            payment={payment}
            title={displayName}
            subtitle={`${quantityLabel(kind, qty, t)} · ${buyer.email}`}
            totalPrice={totalPrice}
            label="Checkout"
          />
        )}
      </div>
    </div>
  );
}
