import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import AdminLogin from "@/components/AdminLogin";
import { ScanResultScreen } from "@/components/scanner/ScanResultPanel";
import { CameraPanel, DoorLog, LastResultStrip, Legend } from "@/components/scanner/ScannerPanels";
import { admittedScreen, screenFor } from "@/components/scanner/scanUtils";
import { feedback, unlockAudio } from "@/components/scanner/feedback";
import { useQrScanner } from "@/components/scanner/useQrScanner";
import { usePwaShell } from "@/components/scanner/usePwaShell";

const SAME_CODE_COOLDOWN_MS = 6000;
const SCAN_TIMEOUT_MS = 8000; // bad venue Wi-Fi must fail fast into CONNECTION ERROR, never hang
const AUTO_DISMISS = { admitted: 3000, declined: 6000 };

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
  const busyRef = useRef(false);
  const lastRef = useRef({ code: "", at: 0 });
  usePwaShell();

  const pushLog = useCallback((entry) => {
    setLog((l) => [{ id: `${Date.now()}-${l.length}`, at: new Date().toLocaleTimeString("cs-CZ"), ...entry }, ...l].slice(0, 20));
  }, []);

  // One scan = one atomic server check-in. No confirmation tap, no offline admits.
  const handleCode = useCallback(async (raw, fromCamera = false) => {
    if (busyRef.current || !raw) return;
    const clean = raw.trim().toUpperCase();
    // the camera keeps decoding the same QR while it stays in frame
    if (fromCamera && clean === lastRef.current.code && Date.now() - lastRef.current.at < SAME_CODE_COOLDOWN_MS) return;
    busyRef.current = true;
    lastRef.current = { code: clean, at: Date.now() };
    try {
      const r = await withRefresh(() => api.post("/scan/checkin", { code: clean }, { timeout: SCAN_TIMEOUT_MS }));
      const next = screenFor(r.data);
      const admitted = admittedScreen(next);
      setScreen(next);
      feedback(admitted);
      setStats((s) => ({ admitted: s.admitted + (admitted ? 1 : 0), declined: s.declined + (admitted ? 0 : 1) }));
      pushLog({ code: next.code || clean, result: admitted ? "admitted" : "declined", note: logNote(next) });
      setCode("");
    } catch (e) {
      if (e?.response?.status === 401) {
        setUser(false);
      } else {
        setScreen({ kind: "offline" });
        feedback(false);
        setStats((s) => ({ ...s, declined: s.declined + 1 }));
        pushLog({ code: clean, result: "error", note: "NO CONNECTION" });
      }
    } finally {
      setTimeout(() => { busyRef.current = false; }, 900);
    }
  }, [pushLog, setUser]);

  const { readerId, cameraOn, starting, error, start, stop, restart } = useQrScanner(handleCode);

  const scanNext = useCallback(() => {
    busyRef.current = false;
    lastRef.current = { code: "", at: 0 };
    setScreen(null);
  }, []);

  useEffect(() => {
    if (!screen) return undefined;
    const ms = admittedScreen(screen) ? AUTO_DISMISS.admitted : AUTO_DISMISS.declined;
    const timer = setTimeout(scanNext, ms);
    return () => clearTimeout(timer);
  }, [screen, scanNext]);

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
    return <AdminLogin title="Door Control" subtitle="Našcanuj to, bráško — sign in to validate tickets" onLogin={setUser} testPrefix="scanner" />;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#060609] text-white" data-testid="scanner-page">
      <ScanResultScreen screen={screen} onNext={scanNext} />
      <header className="glass border-b border-white/10 shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="px-3 sm:px-8 h-12 sm:h-16 flex items-center justify-between gap-3">
          <p className="font-display font-black uppercase text-xs sm:text-base truncate">
            Door Control <span className="text-[#FF0055]">✦</span> <span className="hidden sm:inline text-[#00F0FF]">Našcanuj to, bráško</span>
          </p>
          <div className="flex items-center gap-3 font-mono2 text-[10px] sm:text-xs text-slate-400 shrink-0">
            <span data-testid="scanner-stats">
              <span className="text-emerald-400">{stats.admitted}</span> in · <span className="text-[#FF0055]">{stats.declined}</span> out
            </span>
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
          readerId={readerId}
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
