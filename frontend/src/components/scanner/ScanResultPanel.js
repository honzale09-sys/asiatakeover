import { Check, X, WifiOff } from "lucide-react";

const STYLE = {
  standard: { bg: "#00E5FF", fg: "#00171C", title: "STANDARD" },
  vip: { bg: "#FFD400", fg: "#1A1300", title: "VIP" },
  declined: { bg: "#E10026", fg: "#FFFFFF", title: "DECLINED" },
  offline: { bg: "#E10026", fg: "#FFFFFF", title: "CONNECTION ERROR" },
};

function GiftLine({ gift }) {
  return gift ? (
    <div className="flex items-center justify-center gap-3 rounded-full bg-black/85 px-6 py-3" data-testid="scan-gift-yes">
      <Check size={34} strokeWidth={4} className="text-[#22FF88]" />
      <span className="font-display font-black uppercase text-xl sm:text-3xl text-[#22FF88] tracking-wide">Surprise gift</span>
    </div>
  ) : (
    <div className="flex items-center justify-center gap-3 rounded-full bg-black/85 px-6 py-3" data-testid="scan-gift-no">
      <X size={34} strokeWidth={4} className="text-[#FF2D55]" />
      <span className="font-display font-black uppercase text-xl sm:text-3xl text-[#FF2D55] tracking-wide">No surprise gift</span>
    </div>
  );
}

function DeclinedBody({ screen }) {
  return (
    <>
      <p className="font-display font-black uppercase leading-none text-[16vw] sm:text-[110px]">DECLINED</p>
      <p className="font-display font-black uppercase text-3xl sm:text-5xl mt-4 tracking-wide" data-testid="scan-declined-reason">
        {screen.reason}
      </p>
      {screen.firstScan && (
        <p className="font-mono2 text-sm sm:text-base mt-4" data-testid="scan-first-scan-time">
          First scan {new Date(screen.firstScan).toLocaleString("cs-CZ")}
          {screen.by ? ` · ${screen.by}` : ""}
        </p>
      )}
      <p className="font-display font-black uppercase text-lg sm:text-2xl mt-8 border-4 border-white rounded-2xl px-6 py-3">
        Do not give wristband or gift
      </p>
    </>
  );
}

export function ScanResultScreen({ screen, onDismiss }) {
  if (!screen) return null;
  const s = STYLE[screen.kind];
  const wristband = screen.kind === "standard" || screen.kind === "vip";

  return (
    <button
      type="button"
      onClick={onDismiss}
      data-testid={`scan-screen-${screen.kind}`}
      aria-label="Dismiss scan result"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-5 cursor-pointer"
      style={{ background: s.bg, color: s.fg }}
    >
      {screen.test && (
        <p className="absolute top-5 left-0 right-0 font-mono2 text-[11px] sm:text-sm uppercase tracking-[0.3em] font-bold" data-testid="scan-test-badge">
          Test ticket{screen.label ? ` · ${screen.label}` : ""}
        </p>
      )}
      {screen.kind === "offline" ? (
        <>
          <WifiOff size={72} strokeWidth={3} className="mb-6" />
          <p className="font-display font-black uppercase leading-none text-[11vw] sm:text-[72px]">Connection error</p>
          <p className="font-display font-black uppercase text-2xl sm:text-4xl mt-6 border-4 border-white rounded-2xl px-6 py-3">
            Do not admit
          </p>
        </>
      ) : wristband ? (
        <>
          <p className="font-mono2 uppercase tracking-[0.4em] text-xs sm:text-sm mb-3 opacity-70">Admitted · wristband</p>
          <p className="font-display font-black uppercase leading-none text-[26vw] sm:text-[180px]" data-testid="scan-wristband">
            {s.title}
          </p>
          <div className="mt-8">
            <GiftLine gift={screen.gift} />
          </div>
          <p className="font-mono2 text-xs sm:text-sm mt-8 opacity-70">{screen.code}{screen.holder ? ` · ${screen.holder}` : ""}</p>
        </>
      ) : (
        <DeclinedBody screen={screen} />
      )}
      <p className="font-mono2 text-[10px] uppercase tracking-[0.3em] mt-10 opacity-60">Tap to scan next</p>
    </button>
  );
}
