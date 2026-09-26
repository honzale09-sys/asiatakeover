import { Check, X, WifiOff } from "lucide-react";

const STYLE = {
  standard: { bg: "#00E5FF", fg: "#00171C", title: "STANDARD" },
  vip: { bg: "#FFD400", fg: "#1A1300", title: "VIP" },
  used: { bg: "#E10026", fg: "#FFFFFF", title: "ALREADY USED" },
  declined: { bg: "#E10026", fg: "#FFFFFF", title: "DECLINED" },
  offline: { bg: "#E10026", fg: "#FFFFFF", title: "CONNECTION ERROR" },
};
const WRISTBAND = new Set(["standard", "vip"]);

function GiftLine({ gift }) {
  return gift ? (
    <div className="flex items-center justify-center gap-3 rounded-full bg-black/85 px-5 py-2.5" data-testid="scan-gift-yes">
      <Check size={30} strokeWidth={4} className="text-[#22FF88]" />
      <span className="font-display font-black uppercase text-lg sm:text-2xl text-[#22FF88] tracking-wide">Surprise gift</span>
    </div>
  ) : (
    <div className="flex items-center justify-center gap-3 rounded-full bg-black/85 px-5 py-2.5" data-testid="scan-gift-no">
      <X size={30} strokeWidth={4} className="text-[#FF2D55]" />
      <span className="font-display font-black uppercase text-lg sm:text-2xl text-[#FF2D55] tracking-wide">No surprise gift</span>
    </div>
  );
}

function DeclinedBody({ screen, title }) {
  return (
    <>
      <p className="font-display font-black uppercase leading-none text-[15vw] sm:text-[86px]" data-testid="scan-declined-reason">
        {title}
      </p>
      {screen.kind === "declined" && screen.reason && screen.reason !== title && (
        <p className="font-display font-black uppercase text-2xl sm:text-4xl mt-3 tracking-wide">{screen.reason}</p>
      )}
      {screen.firstScan && (
        <p className="font-mono2 text-xs sm:text-base mt-3" data-testid="scan-first-scan-time">
          First scan {new Date(screen.firstScan).toLocaleString("cs-CZ")}
          {screen.by ? ` · ${screen.by}` : ""}
        </p>
      )}
      <p className="font-display font-black uppercase text-base sm:text-2xl mt-6 border-4 border-white rounded-2xl px-5 py-2.5">
        Do not give wristband or gift
      </p>
    </>
  );
}

export function ScanResultScreen({ screen, onNext }) {
  if (!screen) return null;
  const s = STYLE[screen.kind];

  return (
    <div
      data-testid={`scan-screen-${screen.kind}`}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center text-center px-5 py-6"
      style={{ background: s.bg, color: s.fg }}
    >
      {screen.test && (
        <p className="absolute top-4 left-0 right-0 font-mono2 text-[10px] sm:text-sm uppercase tracking-[0.3em] font-bold" data-testid="scan-test-badge">
          Test ticket{screen.label ? ` · ${screen.label}` : ""}
        </p>
      )}

      <div className="flex-1 flex flex-col items-center justify-center gap-5 min-h-0">
        {screen.kind === "offline" ? (
          <>
            <WifiOff size={64} strokeWidth={3} />
            <p className="font-display font-black uppercase leading-none text-[11vw] sm:text-[64px]">Connection error</p>
            <p className="font-display font-black uppercase text-xl sm:text-3xl border-4 border-white rounded-2xl px-5 py-2.5">Do not admit</p>
          </>
        ) : WRISTBAND.has(screen.kind) ? (
          <>
            <p className="font-mono2 uppercase tracking-[0.4em] text-[10px] sm:text-sm opacity-70">Admitted · wristband</p>
            <p className="font-display font-black uppercase leading-none text-[24vw] sm:text-[150px]" data-testid="scan-wristband">
              {s.title}
            </p>
            <GiftLine gift={screen.gift} />
            <p className="font-mono2 text-[11px] sm:text-sm opacity-70">{screen.code}{screen.holder ? ` · ${screen.holder}` : ""}</p>
          </>
        ) : (
          <DeclinedBody screen={screen} title={s.title} />
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        data-testid="scan-next-button"
        className="w-full max-w-md shrink-0 bg-black/90 text-white font-display font-black uppercase text-xl sm:text-2xl tracking-[0.15em] py-5 rounded-2xl active:scale-95 transition-transform"
      >
        Scan next
      </button>
    </div>
  );
}
