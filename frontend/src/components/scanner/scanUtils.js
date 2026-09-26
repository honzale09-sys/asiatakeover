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

// One scan → one of four door screens: STANDARD / VIP (with or without gift) / DECLINED.
export function screenFor(data) {
  if (data.result === "valid") {
    const vip = data.admission?.wristband === "vip";
    return {
      kind: vip ? "vip" : "standard",
      gift: !!data.admission?.gift,
      code: data.ticket?.code,
      holder: data.ticket?.holder_name,
      test: !!data.test,
      label: data.test ? data.ticket?.tier_name : null,
    };
  }
  return {
    kind: "declined",
    reason: data.reason || (data.result === "used" ? "ALREADY USED" : "INVALID"),
    code: data.ticket?.code,
    firstScan: data.ticket?.checked_in_at,
    by: data.ticket?.checked_in_by,
    test: !!data.test,
    label: data.test ? data.ticket?.tier_name : null,
  };
}

const LOG_CLS = { admitted: "text-emerald-400", declined: "text-[#FF0055]", error: "text-[#FF6A00]" };
export const logResultCls = (result) => LOG_CLS[result] || "text-slate-400";
