import { CheckCircle2, XCircle } from "lucide-react";
import { TierBadges } from "./TierBadges";
import { panelCls } from "./scanUtils";

function Heading({ Icon, color, text }) {
  return (
    <>
      <Icon size={44} className={`${color} mb-4`} />
      <p className={`font-display font-black text-3xl uppercase ${color} mb-3`}>{text}</p>
    </>
  );
}

function ValidResult({ t, onCheckin }) {
  return (
    <div data-testid="scan-result-valid">
      <Heading Icon={CheckCircle2} color="text-emerald-400" text="Valid Ticket" />
      <p className="font-mono2 text-sm text-white">{t.code}</p>
      <p className="text-slate-300 text-sm mt-1">{t.holder_name}</p>
      <p className="font-mono2 text-xs text-[#00F0FF] mt-1 uppercase tracking-wider">{t.tier_name}</p>
      <TierBadges tierName={t.tier_name} />
      <button
        onClick={onCheckin}
        data-testid="checkin-button"
        className="mt-6 w-full bg-emerald-400 text-black hover:bg-[#FFE600] font-display font-black uppercase text-base py-4 rounded-full transition-colors duration-300"
      >
        Admit — Check In
      </button>
    </div>
  );
}

function AdmittedResult({ t }) {
  return (
    <div data-testid="scan-result-admitted">
      <Heading Icon={CheckCircle2} color="text-emerald-400" text="Admitted — Checked In" />
      <p className="font-mono2 text-sm text-white">{t.code}</p>
      <p className="text-slate-300 text-sm mt-1">{t.holder_name} · {t.tier_name}</p>
      <TierBadges tierName={t.tier_name} />
      <p className="font-mono2 text-xs text-slate-400 mt-2">Ticket is now marked as used. Scan the next guest.</p>
    </div>
  );
}

function RefundedResult({ t }) {
  return (
    <div data-testid="scan-result-refunded">
      <Heading Icon={XCircle} color="text-[#FF6A00]" text="Refunded / Cancelled" />
      <p className="font-mono2 text-sm text-white">{t.code}</p>
      <p className="font-mono2 text-sm text-slate-400 mt-2">This order was refunded or cancelled. Do not admit.</p>
    </div>
  );
}

function UsedResult({ t }) {
  return (
    <div data-testid="scan-result-used">
      <Heading Icon={XCircle} color="text-[#FFE600]" text="Already Used" />
      <p className="font-mono2 text-sm text-white">{t.code}</p>
      <p className="text-slate-300 text-sm mt-1">{t.holder_name} · {t.tier_name}</p>
      <TierBadges tierName={t.tier_name} />
      <p className="font-mono2 text-xs text-slate-400 mt-2">
        Checked in at {t.checked_in_at ? new Date(t.checked_in_at).toLocaleString("cs-CZ") : "—"}
        {t.checked_in_by ? ` by ${t.checked_in_by}` : ""}
      </p>
    </div>
  );
}

function InvalidResult() {
  return (
    <div data-testid="scan-result-invalid">
      <Heading Icon={XCircle} color="text-[#FF0055]" text="Invalid Ticket" />
      <p className="font-mono2 text-sm text-slate-400">This code does not exist. Do not admit.</p>
    </div>
  );
}

function ResultBody({ result, onCheckin }) {
  if (!result) {
    return <p className="font-mono2 text-sm text-slate-500 text-center uppercase tracking-[0.25em]">Scan a ticket to validate</p>;
  }
  const t = result.ticket;
  if (result.result === "invalid") return <InvalidResult />;
  if (!t) return null;
  if (result.result === "valid") return <ValidResult t={t} onCheckin={onCheckin} />;
  if (result.result === "admitted") return <AdmittedResult t={t} />;
  if (result.result === "refunded") return <RefundedResult t={t} />;
  if (result.result === "used") return <UsedResult t={t} />;
  return null;
}

export function ScanResultPanel({ result, onCheckin }) {
  return (
    <div
      data-testid="scan-result-panel"
      className={`rounded-3xl border-2 p-8 min-h-[260px] flex flex-col justify-center transition-colors duration-300 ${panelCls(result?.result)}`}
    >
      <ResultBody result={result} onCheckin={onCheckin} />
    </div>
  );
}
