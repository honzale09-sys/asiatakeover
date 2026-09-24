import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/api";

export function usePromo(initialCode) {
  const [promoInput, setPromoInputRaw] = useState(initialCode || "");
  const [promoApplied, setPromoApplied] = useState(null);

  const setPromoInput = (value) => {
    setPromoInputRaw(value);
    setPromoApplied(null);
  };

  const applyPromo = useCallback(async (codeOverride) => {
    const raw = (codeOverride ?? promoInput).trim();
    if (!raw) return;
    try {
      const r = await api.get(`/promo/validate?code=${encodeURIComponent(raw)}`);
      if (r.data.valid) {
        setPromoInputRaw(raw.toUpperCase());
        setPromoApplied({
          code: raw.toUpperCase(),
          percent: r.data.percent_off,
          amount_off_czk: r.data.amount_off_czk || null,
        });
        toast.success(
          r.data.amount_off_czk
            ? `Discount applied — ${r.data.amount_off_czk} Kč off per ticket`
            : `Discount applied — ${r.data.percent_off}% off`
        );
      } else {
        setPromoApplied(null);
        toast.error(r.data.reason || "Invalid discount code");
      }
    } catch (e) {
      console.warn("Checkout: promo validation failed", e);
      toast.error("Could not validate the code — try again");
    }
  }, [promoInput]);

  return { promoInput, setPromoInput, promoApplied, applyPromo };
}
