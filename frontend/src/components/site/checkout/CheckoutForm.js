import { czk } from "@/api";
import { useT } from "@/i18n";
import { PromoField } from "./PromoField";
import { QuantityField, checkoutInputCls, checkoutLabelCls } from "./QuantityField";

function Field({ label, testid, ...props }) {
  return (
    <div>
      <label className={checkoutLabelCls}>{label}</label>
      <input data-testid={testid} required className={checkoutInputCls} {...props} />
    </div>
  );
}

export function CheckoutForm({ kind, displayName, event, buyer, setBuyer, qty, setQty, maxQty, promo, listPrice, totalPrice, onSubmit }) {
  const { t } = useT();
  const set = (key) => (e) => setBuyer((b) => ({ ...b, [key]: e.target.value }));
  return (
    <form onSubmit={onSubmit}>
      <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{t("checkout.secure")}</p>
      <h3 className="font-display font-extrabold text-2xl uppercase mb-1">{displayName}</h3>
      <p className="text-slate-400 text-sm mb-6">
        {event.name} · {event.date_label} · {event.venue} {event.city}
      </p>
      <div className="space-y-4">
        <Field label={t("checkout.fullName")} testid="checkout-name-input" value={buyer.name} onChange={set("name")} placeholder={t("checkout.namePlaceholder")} />
        <Field label={t("checkout.email")} testid="checkout-email-input" type="email" value={buyer.email} onChange={set("email")} placeholder="you@email.com" />
        <Field label={t("checkout.phone")} testid="checkout-phone-input" type="tel" value={buyer.phone} onChange={set("phone")} placeholder="+420 …" />
        <QuantityField kind={kind} qty={qty} setQty={setQty} maxQty={maxQty} />
      </div>
      {kind !== "gold" && kind !== "group" && <PromoField {...promo} listPrice={listPrice} qty={qty} />}
      <button
        type="submit"
        data-testid="checkout-pay-button"
        className="mt-6 w-full bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)]"
      >
        {t("checkout.continueToPayment")} — {czk(totalPrice)}
      </button>
      <p className="font-mono2 text-[11px] text-slate-500 mt-3 text-center">{t("checkout.secureNote")}</p>
      <p className="font-mono2 text-[10px] text-slate-600 mt-2 text-center">
        {t("checkout.termsNoteA")}{" "}
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">
          {t("checkout.termsNoteB")}
        </a>
        {t("checkout.termsNoteC")}
      </p>
    </form>
  );
}
