import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, czk } from "@/api";
import { trackEvent } from "@/lib/tracking";

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

  return (
    <div className="min-h-screen bg-[#060609] text-white flex items-center justify-center px-4" data-testid="success-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <div className="w-full max-w-2xl glass border border-white/10 rounded-3xl p-8 sm:p-10 text-center">
        {(!status || ps === "created" || ps === "pending") && (
          <div data-testid="success-processing">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-white/15 border-t-[#FF6A00] animate-spin" />
            <h1 className="font-display font-extrabold text-2xl uppercase mt-6 mb-2">Confirming your payment…</h1>
            <p className="text-slate-400 text-sm">
              We're verifying your payment with the payment gateway. This page updates automatically — no need to refresh.
            </p>
            {tries.current > 10 && (
              <p className="text-slate-500 text-sm mt-4" data-testid="success-slow-note">
                It's taking a bit longer than usual — your payment is still being confirmed. Once it's done, your tickets appear
                here and we also send them to your email. You can safely keep this page open.
              </p>
            )}
          </div>
        )}

        {(ps === "paid" || ps === "paid_mock") && (
          <div data-testid="success-paid" className="text-left">
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#00F0FF] mb-2 text-center">Payment confirmed</p>
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2 text-center text-[#FF6A00]">You're in!</h1>
            <p className="text-slate-400 text-sm mb-6 text-center">
              Order <span className="font-mono2 text-slate-300">{orderId?.slice(0, 8)}</span> · {status.tier_name} × {status.quantity} ·{" "}
              {czk(status.amount_czk)} · Screenshot your tickets and show the QR code at the entrance.
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
                <p className="font-mono2 text-xs text-slate-500 col-span-2 text-center py-6">Loading your tickets…</p>
              )}
            </div>
          </div>
        )}

        {FINAL_FAIL.has(ps) && (
          <div data-testid="success-failed">
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2 text-[#FF0055]">Payment not completed</h1>
            <p className="text-slate-400 text-sm mb-6">
              {ps === "cancelled" ? "The payment was cancelled." : ps === "timeouted" ? "The payment session expired." : "The payment failed."}{" "}
              No tickets were issued and you have not been charged.
            </p>
            <Link
              to="/tickets"
              data-testid="success-back-to-tickets"
              className="inline-block bg-[#FF6A00] hover:bg-[#FF8534] text-white font-display font-bold uppercase text-sm px-8 py-3.5 rounded-full transition-colors"
            >
              Back to Tickets
            </Link>
          </div>
        )}

        {(ps === "refunded" || ps === "partially_refunded") && (
          <div data-testid="success-refunded">
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2 text-[#FFE600]">Order refunded</h1>
            <p className="text-slate-400 text-sm">This order has been {ps === "refunded" ? "fully" : "partially"} refunded.</p>
          </div>
        )}

        {ps === "missing" && (
          <div data-testid="success-missing">
            <h1 className="font-display font-extrabold text-2xl uppercase mb-2">Order not found</h1>
            <p className="text-slate-400 text-sm mb-6">We couldn't find this order. If you just paid, wait a moment and check again.</p>
            <Link to="/" className="font-mono2 text-xs uppercase tracking-[0.2em] text-[#00F0FF]">← Back home</Link>
          </div>
        )}
      </div>
    </div>
  );
}
