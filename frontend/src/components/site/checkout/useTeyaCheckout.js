import { useEffect } from "react";
import { toast } from "sonner";

export const TEYA_CONTAINER_ID = "teya-checkout-container";

// Mounts the embedded Teya card form into #teya-checkout-container while `active` is true.
export function useTeyaCheckout(payment, active, label = "Checkout") {
  useEffect(() => {
    if (!active || !payment) return undefined;
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
        el.mount(`#${TEYA_CONTAINER_ID}`);
      } catch (e) {
        console.warn(`${label}: Teya SDK failed to load`, e);
        if (!cancelled) toast.error("Payment form failed to load — please refresh and try again.");
      }
    })();
    return () => {
      cancelled = true;
      try {
        el && el.unmount();
      } catch (e) {
        console.warn(`${label}: Teya unmount failed`, e);
      }
    };
  }, [active, payment, label]);
}
