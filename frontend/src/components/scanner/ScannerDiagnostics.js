import { X } from "lucide-react";

const Row = ({ label, value, testid, good }) => (
  <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-white/5">
    <span className="font-mono2 text-[10px] uppercase tracking-[0.15em] text-slate-500 shrink-0">{label}</span>
    <span
      className={`font-mono2 text-[11px] text-right break-all ${good === true ? "text-emerald-400" : good === false ? "text-[#FF0055]" : "text-slate-200"}`}
      data-testid={testid}
    >
      {value === "" || value === null || value === undefined ? "—" : String(value)}
    </span>
  </div>
);

/** Door diagnostics: separates a CAMERA problem from a DECODE problem from a VALIDATION problem. */
export function ScannerDiagnostics({ diag, lastResponse, onClose }) {
  return (
    <div className="fixed inset-0 z-[70] bg-[#060609]/95 backdrop-blur-sm overflow-y-auto" data-testid="scanner-diagnostics">
      <div className="max-w-md mx-auto p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display font-black uppercase text-base">Scanner diagnostics</p>
          <button onClick={onClose} data-testid="diag-close-button" className="text-slate-400 hover:text-[#FF0055] transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="border border-white/10 rounded-2xl bg-[#0D0E15] px-4 py-2">
          <Row label="Camera started" value={diag.cameraOn ? "YES" : "NO"} good={diag.cameraOn} testid="diag-camera-on" />
          <Row label="Camera" value={diag.cameraLabel} testid="diag-camera-label" />
          <Row label="Resolution" value={diag.resolution} testid="diag-resolution" />
          <Row label="Decoder running" value={diag.decoderRunning ? "YES" : "NO"} good={diag.decoderRunning} testid="diag-decoder-running" />
          <Row label="Decoders" value={diag.decodersLoaded} testid="diag-decoders" />
          <Row label="Decoder used" value={diag.decoder} testid="diag-decoder-used" />
          <Row label="Frames analysed" value={diag.frames} testid="diag-frames" />
          <Row label="Detections" value={diag.detections} testid="diag-detections" />
          <Row label="Last detection" value={diag.lastDetectAt} testid="diag-last-detect" />
          <Row label="Last raw QR" value={diag.lastRaw} testid="diag-last-raw" />
          <Row label="Last validation" value={lastResponse} testid="diag-last-response" />
        </div>
        <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-500 mt-4 mb-1.5">Errors</p>
        <div className="border border-white/10 rounded-2xl bg-[#0D0E15] p-3 space-y-1" data-testid="diag-errors">
          {diag.errors.length === 0 && <p className="font-mono2 text-[11px] text-slate-600">No camera or decoder errors.</p>}
          {diag.errors.map((e) => (
            <p key={e} className="font-mono2 text-[10px] text-[#FFB26A] break-all">
              {e}
            </p>
          ))}
        </div>
        <p className="font-mono2 text-[10px] text-slate-500 mt-4 leading-relaxed">
          Camera started NO → camera/permission problem. Camera YES + frames rising but no detections → decode problem
          (light, distance, dirty lens). Detection present but validation empty/error → server problem.
        </p>
      </div>
    </div>
  );
}
