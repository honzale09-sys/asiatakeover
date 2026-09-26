import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import AdminLogin from "@/components/AdminLogin";
import { ScanResultScreen } from "@/components/scanner/ScanResultPanel";
import { CameraPanel, DoorLog, LastResultStrip, Legend } from "@/components/scanner/ScannerPanels";
import { ScannerDiagnostics } from "@/components/scanner/ScannerDiagnostics";
import { admittedScreen, screenFor } from "@/components/scanner/scanUtils";
import { feedback, unlockAudio } from "@/components/scanner/feedback";
import { useQrScanner } from "@/components/scanner/useQrScanner";
import { usePwaShell } from "@/components/scanner/usePwaShell";

const SCAN_TIMEOUT_MS = 8000; // bad venue Wi-Fi must fail fast into CONNECTION ERROR, never hang

function useScannerSession() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data)).catch(async (e) => {
      if (e?.response?.status === 401) {
        try {
          await api.post("/auth/refresh");
          const r = await api.get("/auth/me");
          setUser(r.data);
          return;
        } catch (err) {
          console.warn("Scanner: session refresh failed", err);
        }
      }
      setUser(false);
    });
  }, []);
  return [user, setUser];
}

// Refresh the session once on 401 so door staff are never logged out mid-scan, and retry once on a
// transient failure (edge 429 / 5xx / network hiccup) before declining the ticket.
async function withRefresh(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.response?.status === 401) {
      await api.post("/auth/refresh");
      return await fn();
    }
    if (!e?.response || e.response.status === 429 || e.response.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      return await fn();
    }
    throw e;
  }
}

const logNote = (screen) => {
  if (screen.kind === "used") return "ALREADY USED";
  if (screen.kind === "declined") return screen.reason;
  if (screen.kind === "offline") return "NO CONNECTION";
  if (screen.kind !== "vip") return "STANDARD";
  return screen.gift ? "VIP + GIFT" : "VIP · NO GIFT";
};

export default function Scanner() {
  const [user, setUser] = useScannerSession();
  const [code, setCode] = useState("");
  const [screen, setScreen] = useState(null);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState({ admitted: 0, declined: 0 });
  const [diagOpen, setDiagOpen] = useState(false);
  const [lastResponse, setLastResponse] = useState("");
  const busyRef = useRef(false);
  const scannerRef = useRef(null);
  usePwaShell();

  const pushLog = useCallback((entry) => {
    setLog((l) => [{ id: `${Date.now()}-${l.length}`, at: new Date().toLocaleTimeString("cs-CZ"), ...entry }, ...l].slice(0, 20));
  }, []);

  // One detected QR = exactly one atomic server check-in. The camera layer is already locked when
  // this runs (it pauses on detection); busyRef additionally guards manual entry double taps.
  const handleCode = useCallback(async (raw) => {
    if (busyRef.current || !raw) return;
    const clean = raw.trim().toUpperCase();
    busyRef.current = true;
    scannerRef.current?.pause();
    try {
      const r = await withRefresh(() => api.post("/scan/checkin", { code: clean }, { timeout: SCAN_TIMEOUT_MS }));
      const next = screenFor(r.data);
      const admitted = admittedScreen(next);
      setScreen(next);
      setLastResponse(`${clean} → ${r.data.result}${r.data.reason ? ` / ${r.data.reason}` : ""}${r.data.admission ? ` / ${r.data.admission.wristband}${r.data.admission.gift ? "+gift" : ""}` : ""}`);
      feedback(admitted);
      setStats((s) => ({ admitted: s.admitted + (admitted ? 1 : 0), declined: s.declined + (admitted ? 0 : 1) }));
      pushLog({ code: next.code || clean, result: admitted ? "admitted" : "declined", note: logNote(next) });
      setCode("");
    } catch (e) {
      setLastResponse(`${clean} → ERROR ${e?.response?.status || ""} ${e?.message || ""}`.trim());
      if (e?.response?.status === 401) {
        setUser(false);
      } else {
        setScreen({ kind: "offline" });
        feedback(false);
        setStats((s) => ({ ...s, declined: s.declined + 1 }));
        pushLog({ code: clean, result: "error", note: "NO CONNECTION" });
      }
    } finally {
      busyRef.current = false;
    }
  }, [pushLog, setUser]);

  const scanner = useQrScanner(handleCode);
  scannerRef.current = scanner;
  const { videoRef, cameraOn, starting, error, diag, start, stop, restart, resume } = scanner;

  // SCAN NEXT is the only way back to scanning — the result stays on screen until staff confirm it.
  const scanNext = useCallback(() => {
    busyRef.current = false;
    setScreen(null);
    resume();
  }, [resume]);

  const toggleCamera = () => {
    if (cameraOn) {
      stop();
      return;
    }
    unlockAudio(); // iOS only allows the beep after a user gesture
    start();
  };

  const logout = async () => {
    await api.post("/auth/logout").catch((e) => console.warn("Scanner: logout request failed", e));
    setUser(false);
  };

  if (user === null)
    return <div className="min-h-screen bg-[#060609] flex items-center justify-center font-mono2 text-xs text-slate-500 uppercase tracking-[0.3em]">Loading…</div>;
  if (user === false)
    return (
      <AdminLogin
        title="Door Control"
        subtitle="Našcanuj to, bráško — sign in to validate tickets"
        onLogin={setUser}
        testPrefix="scanner"
        identifierType="text"
        identifierLabel="Username"
      />
    );

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#060609] text-white" data-testid="scanner-page">
      <ScanResultScreen screen={screen} onNext={scanNext} />
      {diagOpen && <ScannerDiagnostics diag={diag} lastResponse={lastResponse} onClose={() => setDiagOpen(false)} />}
      <header className="glass border-b border-white/10 shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-3 sm:px-8 h-12 sm:h-16 flex items-center justify-between gap-3">
          <p className="font-display font-black uppercase text-xs sm:text-base truncate">
            Door Control <span className="text-[#FF0055]">✦</span> <span className="hidden sm:inline text-[#00F0FF]">Našcanuj to, bráško</span>
          </p>
          <div className="flex items-center gap-3 font-mono2 text-[10px] sm:text-xs text-slate-400 shrink-0">
            <span data-testid="scanner-stats">
              <span className="text-emerald-400">{stats.admitted}</span> in · <span className="text-[#FF0055]">{stats.declined}</span> out
            </span>
            <button onClick={() => setDiagOpen(true)} data-testid="diag-open-button" className="hover:text-[#00F0FF] transition-colors uppercase tracking-wider">
              Diag
            </button>
            <button onClick={logout} data-testid="scanner-logout-button" className="hover:text-[#FF0055] transition-colors uppercase tracking-wider">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div
        className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-3 sm:px-8 py-3 sm:py-6 grid grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-2 gap-3 sm:gap-6"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <CameraPanel
          videoRef={videoRef}
          cameraOn={cameraOn}
          starting={starting}
          error={error}
          onToggle={toggleCamera}
          onRestart={restart}
          code={code}
          setCode={setCode}
          onCheck={() => handleCode(code)}
        />
        <div className="flex flex-col gap-3 min-h-0">
          <LastResultStrip last={log[0]} />
          <Legend />
          <DoorLog log={log} />
        </div>
      </div>
    </div>
  );
}
