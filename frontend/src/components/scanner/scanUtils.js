// One scan → one of five door screens: STANDARD / VIP / ALREADY USED / DECLINED / CONNECTION ERROR.
export function screenFor(data) {
  const base = { code: data.ticket?.code, test: !!data.test, label: data.test ? data.ticket?.tier_name : null };
  if (data.result === "valid") {
    return {
      ...base,
      kind: data.admission?.wristband === "vip" ? "vip" : "standard",
      gift: !!data.admission?.gift,
      holder: data.ticket?.holder_name,
    };
  }
  const reason = data.reason || (data.result === "used" ? "ALREADY USED" : "INVALID");
  return {
    ...base,
    kind: reason === "ALREADY USED" ? "used" : "declined",
    reason,
    firstScan: data.ticket?.checked_in_at,
    by: data.ticket?.checked_in_by,
  };
}

export const admittedScreen = (screen) => screen.kind === "standard" || screen.kind === "vip";

const LOG_CLS = { admitted: "text-emerald-400", declined: "text-[#FF0055]", error: "text-[#FF6A00]" };
export const logResultCls = (result) => LOG_CLS[result] || "text-slate-400";
