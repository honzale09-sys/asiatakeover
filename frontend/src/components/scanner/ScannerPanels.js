import { Camera, ScanLine } from "lucide-react";
import { logResultCls } from "./scanUtils";

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";

export function CameraPanel({ cameraOn, onToggleCamera, code, setCode, onCheck }) {
  return (
    <div>
      <div className="relative border-2 border-dashed border-white/15 rounded-3xl overflow-hidden bg-[#0D0E15] min-h-[320px] flex items-center justify-center" data-testid="camera-viewport">
        <div id="qr-reader" className="w-full" />
        {cameraOn && <div className="absolute inset-x-6 h-0.5 bg-[#FF0055] scan-laser neon-shadow pointer-events-none" />}
        {!cameraOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
            <ScanLine size={40} className="text-slate-600" />
            <p className="font-mono2 text-xs text-slate-500 uppercase tracking-[0.25em]">Camera off</p>
          </div>
        )}
      </div>
      <button
        onClick={onToggleCamera}
        data-testid="camera-start-button"
        className={`mt-4 w-full flex items-center justify-center gap-2 font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 ${
          cameraOn ? "border border-white/20 hover:border-[#FF0055] hover:text-[#FF0055]" : "bg-[#00F0FF] text-black hover:bg-[#FFE600] cyan-shadow"
        }`}
      >
        <Camera size={16} /> {cameraOn ? "Stop Camera" : "Start Camera Scan"}
      </button>

      <div className="mt-6">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-2">Manual entry</p>
        <div className="flex gap-2">
          <input
            data-testid="qr-code-input"
            className={`${inputCls} font-mono2 uppercase`}
            placeholder="ATF-1A2B3C"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCheck()}
          />
          <button
            onClick={onCheck}
            data-testid="scan-check-button"
            className="shrink-0 bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm px-6 rounded-lg transition-colors duration-300"
          >
            Check
          </button>
        </div>
      </div>
    </div>
  );
}

export function DoorLog({ log }) {
  return (
    <div className="border border-white/10 rounded-2xl bg-[#0D0E15] p-5" data-testid="scan-log">
      <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-3">Door log</p>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {log.map((l, i) => (
          <div key={l.id} className="flex items-center justify-between gap-2 font-mono2 text-xs" data-testid={`scan-log-entry-${i}`}>
            <span className="text-slate-300">{l.code}</span>
            <span className={`${logResultCls(l.result)} truncate`}>{l.note || l.result.toUpperCase()}</span>
            <span className="text-slate-600">{l.at}</span>
          </div>
        ))}
        {log.length === 0 && <p className="font-mono2 text-xs text-slate-600">No scans yet.</p>}
      </div>
    </div>
  );
}
