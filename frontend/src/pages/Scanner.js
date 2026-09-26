import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { api } from "@/api";
import AdminLogin from "@/components/AdminLogin";
import { ScanResultScreen } from "@/components/scanner/ScanResultPanel";
import { CameraPanel, DoorLog, LastResultStrip, Legend } from "@/components/scanner/ScannerPanels";
import { beep, screenFor } from "@/components/scanner/scanUtils";

// Session check with one silent refresh — keeps the scanner logged in through long events.
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

// Refresh the session once on 401 so door staff never get logged out mid-scan,
// and retry once on transient failures (edge 429 / 5xx / network hiccup) before declining.
async function withRefresh(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.response?.status === 401) {
      await api.post("/auth/refresh");
      return await fn();
    }
    if (!e?.response || e.response.status === 429 || e.response.status >= 500) {
      await new Promise((r) => setTimeout(r, 1200));
      return await fn();
    }
    throw e;
  }
}

function useCamera(onCode) {
  const [cameraOn, setCameraOn] = useState(false);
  const scannerRef = useRef(null);
  useEffect(() => () => {
    scannerRef.current?.stop().catch((e) => console.warn("Scanner: camera stop on unmount failed", e));
  }, []);
  const start = async () => {
    try {
      const s = new Html5Qrcode("qr-reader");
      scannerRef.current = s;
      await s.start({ facingMode: "environment" }, { fps: 8, qrbox: { width: 240, height: 240 } }, (text) => onCode(text, true), () => {});
      setCameraOn(true);
    } catch (e) {
      console.warn("Scanner: camera start failed", e);
      toast.error("Camera unavailable on this device — use manual code entry below.");
    }
  };
  const stop = async () => {
    try {
      await scannerRef.current?.stop();
    } catch (e) {
      console.warn("Scanner: camera stop failed", e);
    }
    scannerRef.current = null;
    setCameraOn(false);
  };
  return { cameraOn, toggle: cameraOn ? stop : start };
}

const logNote = (screen) => {
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
  const processingRef = useRef(false);
  const lastRef = useRef({ code: "", at: 0 });

  // One scan = one atomic server check-in. No second confirmation tap, no offline admits.
  const handleCode = useCallback(async (raw, fromCamera = false) => {
    if (processingRef.current || !raw) return;
    const clean = raw.trim().toUpperCase();
    // the camera keeps decoding the same QR while it stays in frame — ignore it for a few seconds
    if (fromCamera && clean === lastRef.current.code && Date.now() - lastRef.current.at < 8000) return;
    processingRef.current = true;
    lastRef.current = { code: clean, at: Date.now() };
    try {
      const r = await withRefresh(() => api.post("/scan/checkin", { code: clean }));
      const next = screenFor(r.data);
      const admitted = next.kind !== "declined";
      setScreen(next);
      beep(admitted);
      setStats((s) => ({ admitted: s.admitted + (admitted ? 1 : 0), declined: s.declined + (admitted ? 0 : 1) }));
      setLog((l) => [{
        id: `${Date.now()}-${l.length}`, code: next.code || clean,
        result: admitted ? "admitted" : "declined", note: logNote(next),
        at: new Date().toLocaleTimeString("cs-CZ"),
      }, ...l].slice(0, 15));
      setCode("");
    } catch (e) {
      if (e?.response?.status === 401) {
        setUser(false);
      } else {
        setScreen({ kind: "offline" });
        beep(false);
        setStats((s) => ({ ...s, declined: s.declined + 1 }));
        setLog((l) => [{
          id: `${Date.now()}-${l.length}`, code: clean, result: "error", note: "NO CONNECTION",
          at: new Date().toLocaleTimeString("cs-CZ"),
        }, ...l].slice(0, 15));
      }
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 1200);
    }
  }, [setUser]);

  const { cameraOn, toggle } = useCamera(handleCode);

  useEffect(() => {
    if (!screen) return undefined;
    const timer = setTimeout(() => setScreen(null), screen.kind === "declined" || screen.kind === "offline" ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [screen]);

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
      <ScanResultScreen screen={screen} onDismiss={() => { processingRef.current = false; setScreen(null); }} />
      <header className="glass border-b border-white/10 shrink-0">
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

      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-3 sm:px-8 py-3 sm:py-6 grid grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <CameraPanel cameraOn={cameraOn} onToggleCamera={toggle} code={code} setCode={setCode} onCheck={() => handleCode(code)} />
        <div className="flex flex-col gap-3 min-h-0">
          <LastResultStrip last={log[0]} />
          <Legend />
          <DoorLog log={log} />
        </div>
      </div>
    </div>
  );
}
