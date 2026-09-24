const has = (tier, word) => tier.name.toUpperCase().includes(word);
const byPrice = (a, b) => a.price_czk - b.price_czk;
export const isAvailable = (tier) => (tier.sold || 0) < tier.capacity;

// Splits the tier list into the cards the public page shows (active GA release, group, VIP, gold).
export function pickTiers(tiers) {
  const ga = tiers.filter((x) => !has(x, "VIP") && !has(x, "GROUP")).sort(byPrice);
  const vipTiers = tiers.filter((x) => has(x, "VIP") && !has(x, "GOLD")).sort(byPrice);
  const group = tiers.filter((x) => has(x, "GROUP")).sort(byPrice).find(isAvailable);
  const gold = tiers.find((x) => has(x, "GOLD"));
  const activeGA = ga.find(isAvailable);
  const vip = vipTiers.find(isAvailable) || vipTiers[vipTiers.length - 1];
  return {
    ga,
    activeGA,
    nextGA: activeGA ? ga[ga.indexOf(activeGA) + 1] : null,
    group,
    vip,
    nextVip: vip && isAvailable(vip) ? vipTiers[vipTiers.indexOf(vip) + 1] : null,
    vipOut: vip ? !isAvailable(vip) : false,
    gold,
    goldOut: gold ? !isAvailable(gold) : false,
  };
}
