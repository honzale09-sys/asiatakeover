export function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 200;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.15 : 0.4));
  } catch (e) {
    console.warn("Scanner: audio beep unavailable", e);
  }
}

export function ticketFlags(tierName) {
  const tn = (tierName || "").toUpperCase();
  const isGuest = /GUEST\s*LIST/.test(tn);
  const isGold = tn.includes("GOLD");
  const isAmbVip = tn === "AMBASSADOR VIP";
  return {
    isGuest,
    isGold,
    isAmbVip,
    isAmbStd: tn === "AMBASSADOR STANDARD",
    isVip: tn.includes("VIP") && !isGuest && !isGold && !isAmbVip,
  };
}

const PANEL_CLS = {
  idle: "border-white/10 bg-[#0D0E15]",
  valid: "border-emerald-400 bg-emerald-400/10 shadow-[0_0_40px_rgba(52,211,153,0.25)]",
  admitted: "border-emerald-400 bg-emerald-400/10 shadow-[0_0_40px_rgba(52,211,153,0.25)]",
  refunded: "border-[#FF6A00] bg-[#FF6A00]/10 shadow-[0_0_40px_rgba(255,106,0,0.25)]",
};
export const panelCls = (result) => PANEL_CLS[result || "idle"] || "border-[#FF0055] bg-[#FF0055]/10 neon-shadow";

const LOG_CLS = { valid: "text-emerald-400", used: "text-[#FFE600]" };
export const logResultCls = (result) => LOG_CLS[result] || "text-[#FF0055]";
