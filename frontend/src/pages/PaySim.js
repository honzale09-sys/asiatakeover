import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, czk } from "@/api";

export default function PaySim() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/orders/${orderId}/status`)
      .then((r) => setOrder(r.data))
      .catch(() => setOrder(false));
  }, [orderId]);

  const act = async (action) => {
    setBusy(true);
    setError("");
    try {
      await api.post("/payments/sim/action", { order_id: orderId, action });
      navigate(`/success?order_id=${orderId}`);
    } catch (e) {
      setError(e?.response?.data?.detail || "Simulation failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060609] text-white flex items-center justify-center px-4" data-testid="pay-sim-page">
      <div className="w-full max-w-md border-2 border-dashed border-[#FFE600]/50 rounded-3xl p-8 text-center bg-[#0D0E15]">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#FFE600] mb-3" data-testid="pay-sim-badge">
          Test mode — simulated GoPay payment
        </p>
        {order === false && <p className="text-slate-400 text-sm">Order not found.</p>}
        {order && (
          <>
            <h1 className="font-display font-extrabold text-2xl uppercase mb-1">{czk(order.amount_czk)}</h1>
            <p className="text-slate-400 text-sm mb-8">
              {order.tier_name} × {order.quantity} · {order.event_name}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => act("paid")}
                disabled={busy}
                data-testid="sim-pay-success-button"
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors disabled:opacity-50"
              >
                Simulate successful payment
              </button>
              <button
                onClick={() => act("failed")}
                disabled={busy}
                data-testid="sim-pay-fail-button"
                className="w-full border border-[#FF0055] text-[#FF0055] hover:bg-[#FF0055]/10 font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors disabled:opacity-50"
              >
                Simulate failed payment
              </button>
              <button
                onClick={() => act("cancelled")}
                disabled={busy}
                data-testid="sim-pay-cancel-button"
                className="w-full text-slate-400 hover:text-white font-mono2 text-xs uppercase tracking-[0.2em] py-2 transition-colors disabled:opacity-50"
              >
                Cancel payment
              </button>
            </div>
          </>
        )}
        {error && <p className="text-[#FF0055] font-mono2 text-xs mt-4">{error}</p>}
        <p className="font-mono2 text-[10px] text-slate-600 mt-8 leading-relaxed">
          No real payment is processed. This page only exists until GoPay credentials are configured — then customers are
          redirected to the real GoPay gateway instead.
        </p>
      </div>
    </div>
  );
}
