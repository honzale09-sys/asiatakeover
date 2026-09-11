import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, czk } from "@/api";
import { trackEvent } from "@/lib/tracking";
import { useT } from "@/i18n";

const FINAL_FAIL = new Set(["failed", "cancelled", "timeouted"]);

export default function Success() {
  const [params] = useSearchParams();
  const orderId = params.get("order_id");
  const [status, setStatus] = useState(null);
  const [tickets, setTickets] = useState(null);
  const tries = useRef(0);

  useEffect(() => {
    if (!orderId) {
      setStatus({ payment_status: "missing" });
      return;
    }
    let timer;
    const poll = async () => {
      try {
        const r = await api.get(`/orders/${orderId}/status`);
        setStatus(r.data);
        const ps = r.data.payment_status;
        if (ps === "paid" || ps === "paid_mock") {
          try {
            const t = await api.get(`/orders/${orderId}/tickets`);
            setTickets(t.data.tickets);
          } catch {}
          const firedKey = `atf_purchase_${orderId}`;
          if (!localStorage.getItem(firedKey)) {
            trackEvent(
              "Purchase",
              {
                value: r.data.amount_czk,
                currency: "CZK",
                content_ids: [r.data.tier_id],
                content_type: "product",
                content_name: r.data.tier_name,
                num_items: r.data.quantity,
              },
              r.data.purchase_event_id
            );
            localStorage.setItem(firedKey, "1");
          }
          return;
        }
        if (FINAL_FAIL.has(ps) || ps === "refunded" || ps === "partially_refunded") return;
        tries.current += 1;
        if (tries.current < 450) timer = setTimeout(poll, 4000);
      } catch {
        setStatus({ payment_status: "missing" });
      }
    };
    poll();
    return () => clearTimeout(timer);
  }, [orderId]);

  const ps = status?.payment_status;
  const { t } = useT();

  return (
    <div className="min-h-screen bg-[#060609] text-white flex items-center justify-center px-4" data-testid="success-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <div className="w-full max-w-2xl glass border border-white/10 rounded-3xl p-8 sm:p-10 text-center">
        {(!status || ps === "created" || ps === "pending") && (
          <div data-testid="success-processing">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-white/15 border-t-[#FF6A00] animate-spin" />
            <h1 className="font-display font-extrabold text-2xl uppercase mt-6 mb-2">{t("success.confirming")}</h1>
            <p className="text-slate-400 text-sm">
              {t("success.confirmingText")}
            </p>
            {tries.current > 10 && (
              <p className="text-slate-500 text-sm mt-4" data-testid="success-slow-note">
                {t("success.slowNote")}
              </p>
            )}
          </div>
        )}

        {(ps === "paid" || ps === "paid_mock") && (
          <div data-testid="success-paid" className="text-left">
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2 text-center">{t("success.confirmed")}</p>
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2 text-center text-[#FF6A00]">{t("success.youreIn")}</h1>
            <p className="text-slate-400 text-sm mb-6 text-center">
              {t("success.orderLine")
                .replace("{order}", orderId?.slice(0, 8) || "")
                .replace("{tier}", status.tier_name || "")
                .replace("{qty}", status.quantity)
                .replace("{amount}", czk(status.amount_czk))}
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {(tickets || []).map((t) => (
                <div key={t.code} data-testid={`success-ticket-${t.code}`} className="border border-white/10 rounded-xl p-4 bg-[#0D0E15] flex gap-4 items-center">
                  <div className="bg-white rounded-lg p-1.5 shrink-0">
                    <img src={t.qr} alt={`QR ${t.code}`} className="w-24 h-24" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono2 font-bold text-sm text-[#00F0FF]">{t.code}</p>
                    <p className="font-display text-xs uppercase mt-1 truncate">{t.holder_name}</p>
                    <p className="font-mono2 text-[11px] text-slate-400 mt-1">{t.tier_name}</p>
                  </div>
                </div>
              ))}
              {!tickets && (
                <p className="font-mono2 text-xs text-slate-500 col-span-2 text-center py-6">{t("success.loadingTickets")}</p>
              )}
            </div>
          </div>
        )}

        {FINAL_FAIL.has(ps) && (
          <div data-testid="success-failed">
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2 text-[#FF0055]">{t("success.notCompleted")}</h1>
            <p className="text-slate-400 text-sm mb-6">
              {ps === "cancelled" ? t("success.cancelled") : ps === "timeouted" ? t("success.expired") : t("success.failed")}{" "}
              {t("success.noCharge")}
            </p>
            <Link
              to="/tickets"
              data-testid="success-back-to-tickets"
              className="inline-block bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-sm px-8 py-3.5 rounded-full transition-colors"
            >
              {t("success.backToTickets")}
            </Link>
          </div>
        )}

        {(ps === "refunded" || ps === "partially_refunded") && (
          <div data-testid="success-refunded">
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2 text-[#FFE600]">{t("success.refunded")}</h1>
            <p className="text-slate-400 text-sm">{t("success.refundedText").replace("{how}", ps === "refunded" ? t("success.fully") : t("success.partially"))}</p>
          </div>
        )}

        {ps === "missing" && (
          <div data-testid="success-missing">
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2">{t("success.notFound")}</h1>
            <p className="text-slate-400 text-sm mb-6">{t("success.notFoundText")}</p>
            <Link to="/" className="font-mono2 text-xs uppercase tracking-[0.2em] text-[#00F0FF]">{t("success.backHome")}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
