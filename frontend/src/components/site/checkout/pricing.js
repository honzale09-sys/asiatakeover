export const GOLD_TABLE_FEE = 3999;
export const GOLD_PER_GUEST = 899;
export const GOLD_GUEST_OPTIONS = Array.from({ length: 11 }, (_, i) => i + 4);

export const goldTotal = (guests) => GOLD_TABLE_FEE + GOLD_PER_GUEST * guests;

export function tierKind(tier) {
  const n = (tier?.name || "").toLowerCase();
  if (n.includes("gold")) return "gold";
  if (n.includes("group")) return "group";
  if (n.includes("vip")) return "vip";
  return "standard";
}

export function discountedUnitPrice(listPrice, promo) {
  if (!promo) return listPrice;
  if (promo.amount_off_czk) return Math.max(1, listPrice - promo.amount_off_czk);
  return Math.max(1, Math.round((listPrice * (100 - promo.percent)) / 100));
}

export function checkoutDisplayName(kind, t) {
  const names = {
    gold: t("tickets.gold"),
    vip: t("tickets.vip"),
    group: `${t("tickets.group")} — 4× ${t("tickets.standard")}`,
    standard: t("tickets.standard"),
  };
  return names[kind];
}

export function quantityLabel(kind, qty, t) {
  if (kind === "group") return t("checkout.groupTickets");
  if (kind === "gold") return `${qty} ${t("checkout.guestsWord")}`;
  return `${qty} ${qty > 1 ? t("checkout.ticketMany") : t("checkout.ticketOne")}`;
}
