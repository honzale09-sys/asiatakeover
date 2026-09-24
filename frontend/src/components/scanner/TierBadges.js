import { ticketFlags } from "./scanUtils";

const bigBadgeCls = "mt-3 inline-flex items-center gap-2 rounded-2xl border-2 px-6 py-3 font-display font-black uppercase text-xl sm:text-2xl tracking-wider";
const goldBg = { background: "linear-gradient(90deg, #b8912f, #f5d76e 50%, #d4af37)" };

export function TierBadges({ tierName }) {
  const f = ticketFlags(tierName);
  return (
    <>
      {f.isVip && (
        <span data-testid="scan-vip-badge" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#C9A227] bg-[#C9A227]/15 px-4 py-1.5 font-display font-black uppercase text-sm tracking-wider text-[#C9A227] shadow-[0_0_25px_rgba(201,162,39,0.35)]">
          🏆 VIP Table
        </span>
      )}
      {f.isGuest && (
        <span data-testid="scan-guest-badge" className={`${bigBadgeCls} border-[#C9A227] bg-[#C9A227] text-black shadow-[0_0_40px_rgba(201,162,39,0.55)]`}>
          🏆 VIP Guest List
        </span>
      )}
      {f.isGold && (
        <span data-testid="scan-gold-badge" className={`${bigBadgeCls} border-[#d4af37] text-black shadow-[0_0_40px_rgba(212,175,55,0.55)]`} style={goldBg}>
          ◆ VIP GOLD
        </span>
      )}
      {f.isAmbVip && (
        <span data-testid="scan-ambvip-badge" className={`${bigBadgeCls} border-[#C9A227] bg-[#C9A227] text-black shadow-[0_0_40px_rgba(201,162,39,0.55)]`}>
          🏆 Ambassador VIP
        </span>
      )}
      {f.isAmbStd && (
        <span data-testid="scan-ambstd-badge" className="mt-3 inline-flex items-center gap-2 rounded-2xl border-2 border-[#00F0FF] bg-[#00F0FF]/15 px-5 py-2.5 font-display font-black uppercase text-lg tracking-wider text-[#00F0FF]">
          ★ Ambassador
        </span>
      )}
    </>
  );
}
