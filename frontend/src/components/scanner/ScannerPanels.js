import { Camera, RotateCcw, ScanLine } from "lucide-react";
import { logResultCls } from "./scanUtils";

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-base text-white focus:border-[#FF0055] outline-none transition-colors";

export function CameraPanel({ readerId, cameraOn, starting, error, onToggle, onRestart, code, setCode, onCheck }) {
  return (
    <div className="flex flex-col gap-2.5 min-h-0">
      <div
        className="relative border-2 border-dashed border-white/15 rounded-2xl overflow-hidden bg-[#0D0E15] h-[32vh] min-h-[180px] sm:h-[300px] lg:h-[340px] flex items-center justify-center"
        data-testid="camera-viewport"
      >
        <div id={readerId} className="w-full h-full" />
        {cameraOn && <div className="absolute inset-x-6 h-0.5 bg-[#FF0055] scan-laser neon-shadow pointer-events-none" />}
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none px-4 text-center">
            <ScanLine size={26} className="text-slate-600" />
            <p className="font-mono2 text-[10px] text-slate-500 uppercase tracking-[0.25em]">
              {starting ? "Starting camera…" : "Camera off"}
            </p>
            {error && <p className="font-mono2 text-[10px] text-[#FF6A00] max-w-xs" data-testid="camera-error">{error}</p>}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onToggle}
          data-testid="camera-start-button"
          className={`flex-1 flex items-center justify-center gap-2 font-display font-bold uppercase text-xs sm:text-sm py-3 rounded-full transition-colors duration-300 ${
            cameraOn ? "border border-white/20 hover:border-[#FF0055] hover:text-[#FF0055]" : "bg-[#00F0FF] text-black hover:bg-[#FFE600] cyan-shadow"
          }`}
        >
          <Camera size={15} /> {cameraOn ? "Stop camera" : "Start camera scan"}
        </button>
        <button
          onClick={onRestart}
          data-testid="camera-restart-button"
          className="shrink-0 flex items-center gap-2 border border-white/20 hover:border-[#00F0FF] hover:text-[#00F0FF] font-display font-bold uppercase text-xs sm:text-sm px-4 rounded-full transition-colors duration-300"
        >
          <RotateCcw size={14} /> Restart
        </button>
      </div>
      <div className="flex gap-2">
        <input
          data-testid="qr-code-input"
          className={`${inputCls} font-mono2 uppercase`}
          placeholder="ATF-1A2B3C"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCheck()}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button
          onClick={onCheck}
          data-testid="scan-check-button"
          className="shrink-0 bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-xs sm:text-sm px-5 rounded-lg transition-colors duration-300"
        >
          Check
        </button>
      </div>
    </div>
  );
}

const STRIP = {
  admitted: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  declined: "border-[#FF0055]/50 bg-[#FF0055]/10 text-[#FF7BA3]",
  error: "border-[#FF6A00]/50 bg-[#FF6A00]/10 text-[#FFB26A]",
};
const STRIP_TITLE = { admitted: "Admitted", declined: "Declined", error: "No connection" };

export function LastResultStrip({ last }) {
  if (!last)
    return (
      <div className="border border-white/10 rounded-2xl bg-[#0D0E15] px-4 py-3 text-center" data-testid="last-result">
        <p className="font-mono2 text-[10px] uppercase tracking-[0.25em] text-slate-500">Point the camera at a ticket QR</p>
      </div>
    );
  return (
    <div className={`border rounded-2xl px-4 py-3 ${STRIP[last.result]}`} data-testid="last-result">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display font-black uppercase text-lg sm:text-2xl leading-none truncate">{STRIP_TITLE[last.result]}</p>
        <p className="font-mono2 text-[10px] text-slate-400 shrink-0">{last.at}</p>
      </div>
      <p className="font-mono2 text-xs mt-1.5 truncate">{last.note} · {last.code}</p>
    </div>
  );
}

export function Legend() {
  return (
    <div className="flex gap-2 font-mono2 text-[9px] sm:text-[10px] uppercase tracking-[0.1em]" data-testid="scanner-legend">
      <span className="flex-1 text-center rounded-lg py-1.5 bg-[#00E5FF] text-black font-bold">Standard</span>
      <span className="flex-1 text-center rounded-lg py-1.5 bg-[#FFD400] text-black font-bold">VIP</span>
      <span className="flex-1 text-center rounded-lg py-1.5 bg-[#E10026] text-white font-bold">Declined</span>
    </div>
  );
}

export function DoorLog({ log }) {
  return (
    <div className="border border-white/10 rounded-2xl bg-[#0D0E15] p-4 flex flex-col min-h-0 flex-1" data-testid="scan-log">
      <p className="font-mono2 text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-2 shrink-0">Door log</p>
      <div className="space-y-1.5 overflow-y-auto min-h-0 flex-1">
        {log.map((l, i) => (
          <div key={l.id} className="flex items-center justify-between gap-2 font-mono2 text-[11px]" data-testid={`scan-log-entry-${i}`}>
            <span className="text-slate-300 shrink-0">{l.code}</span>
            <span className={`${logResultCls(l.result)} truncate`}>{l.note || l.result.toUpperCase()}</span>
            <span className="text-slate-600 shrink-0">{l.at}</span>
          </div>
        ))}
        {log.length === 0 && <p className="font-mono2 text-[11px] text-slate-600">No scans yet.</p>}
      </div>
    </div>
  );
}
