import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, czk, formatError } from "@/api";
import { LangPicker } from "@/components/site/Navbar";
import { useT } from "@/i18n";

const inputCls =
  "w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors";

export default function UpgradePage() {
  const { t, lp } = useT();
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState(null);
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState("verify"); // verify | pay | processing | payment
  const [payment, setPayment] = useState(null);

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

  const verify = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    try {
      const r = await api.post("/upgrade/check", { code: code.trim() });
      setTicket(r.data);
      setStep("pay");
    } catch (err) {
      setTicket(null);
      toast.error(formatError(err));
    } finally {
      setChecking(false);
    }
  };

  const pay = async (e) => {
    e.preventDefault();
    setStep("processing");
    try {
      const r = await api.post("/upgrade/create", { code: ticket.code, name, email, phone });
      if (r.data.mode === "teya" && r.data.session_token) {
        setPayment({ orderId: r.data.order_id, sessionToken: r.data.session_token });
        setStep("payment");
      } else {
        window.location.assign(r.data.payment_url);
      }
    } catch (err) {
      toast.error(formatError(err));
      setStep("pay");
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="upgrade-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <header className="px-5 sm:px-10 h-16 flex items-center justify-between border-b border-white/10">
        <Link to={lp("/")} data-testid="upgrade-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
        <LangPicker />
      </header>
      <main className="px-4 py-12 sm:py-16 flex justify-center">
        <div className="w-full max-w-lg glass border border-[#C9A227]/30 rounded-3xl p-6 sm:p-10 shadow-[0_0_60px_rgba(201,162,39,0.08)]">
          <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#E7C55A] mb-2">{t("upgrade.priceLine")}: 400 Kč</p>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-2">{t("upgrade.title")}</h1>
          <p className="text-slate-400 text-sm mb-8">{t("upgrade.subtitle")}</p>

          <form onSubmit={verify} className="mb-6">
            <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">{t("upgrade.codeLabel")}</label>
            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value); setTicket(null); setStep("verify"); }}
                placeholder={t("upgrade.codePlaceholder")}
                data-testid="upgrade-code-input"
                className={`${inputCls} flex-1 uppercase placeholder:normal-case font-mono2 tracking-widest`}
              />
              <button
                type="submit"
                disabled={checking}
                data-testid="upgrade-verify-button"
                className="font-mono2 text-xs uppercase tracking-[0.15em] border border-[#C9A227] text-[#E7C55A] hover:bg-[#C9A227]/10 rounded-xl px-5 transition-colors disabled:opacity-50"
              >
                {checking ? "…" : t("upgrade.verify")}
              </button>
            </div>
          </form>

          {ticket && step !== "verify" && step !== "processing" && step !== "payment" && (
            <div className="border border-white/10 rounded-xl p-4 bg-[#0D0E15] mb-6" data-testid="upgrade-ticket-found">
              <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-green-400 mb-1">{t("upgrade.found")}</p>
              <p className="font-mono2 font-bold text-sm text-[#00F0FF]">{ticket.code}</p>
              <p className="font-mono2 text-[11px] text-slate-400 mt-1">{ticket.holder_name} · {ticket.tier_name}</p>
            </div>
          )}

          {step === "pay" && ticket && (
            <form onSubmit={pay} className="space-y-4" data-testid="upgrade-pay-form">
              <input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("checkout.fullName")} data-testid="upgrade-name-input" />
              <input required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" data-testid="upgrade-email-input" />
              <input required type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+420 …" data-testid="upgrade-phone-input" />
              <p className="font-mono2 text-[11px] text-[#E7C55A] leading-relaxed">{t("upgrade.sameQr")}</p>
              <button
                type="submit"
                data-testid="upgrade-pay-button"
                className="w-full font-display font-bold uppercase text-base py-4 rounded-full text-black transition-all duration-200 active:scale-[0.97] min-h-[56px] hover:shadow-[0_0_35px_rgba(212,175,55,0.45)]"
                style={{ background: "linear-gradient(90deg, #b8912f, #f5d76e 50%, #d4af37)" }}
              >
                {t("upgrade.pay")} — 400 Kč
              </button>
            </form>
          )}

          {step === "processing" && (
            <div className="py-10 flex flex-col items-center gap-5" data-testid="upgrade-processing">
              <div className="w-12 h-12 rounded-full border-2 border-white/15 border-t-[#C9A227] animate-spin" />
              <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-slate-400">{t("upgrade.processing")}</p>
            </div>
          )}

          {step === "payment" && payment && (
            <div data-testid="upgrade-teya-checkout">
              <div id="teya-checkout-container" data-testid="teya-checkout-container" className="bg-white rounded-xl overflow-hidden min-h-[320px]" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
