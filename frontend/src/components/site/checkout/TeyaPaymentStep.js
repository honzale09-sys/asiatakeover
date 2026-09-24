import { czk } from "@/api";
import { useT } from "@/i18n";
import { TEYA_CONTAINER_ID, useTeyaCheckout } from "./useTeyaCheckout";

export function TeyaPaymentStep({ payment, title, subtitle, totalPrice, label }) {
  const { t } = useT();
  useTeyaCheckout(payment, true, label);
  return (
    <div data-testid="teya-embedded-checkout">
      <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{t("checkout.securePayment")}</p>
      <h3 className="font-display font-extrabold text-xl uppercase mb-1">
        {title} — {czk(totalPrice)}
      </h3>
      <p className="text-slate-400 text-sm mb-5">{subtitle}</p>
      <div id={TEYA_CONTAINER_ID} data-testid="teya-checkout-container" className="bg-white rounded-xl overflow-hidden min-h-[320px]" />
      <p className="font-mono2 text-[10px] text-slate-600 mt-3 text-center">{t("checkout.teyaNote")}</p>
    </div>
  );
}

export function ProcessingStep({ text }) {
  return (
    <div className="py-16 flex flex-col items-center gap-5" data-testid="checkout-processing">
      <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-[#FF6A00] animate-spin" />
      <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-slate-400">{text}</p>
    </div>
  );
}
