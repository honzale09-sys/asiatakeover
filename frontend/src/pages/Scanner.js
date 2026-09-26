import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { api } from "@/api";
import AdminLogin from "@/components/AdminLogin";
import { ScanResultScreen } from "@/components/scanner/ScanResultPanel";
import { CameraPanel, DoorLog } from "@/components/scanner/ScannerPanels";
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
      await s.start({ facingMode: "environment" }, { fps: 8, qrbox: { width: 240, height: 240 } }, (text) => onCode(text), () => {});
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
  return screen.kind === "vip" ? (screen.gift ? "VIP + GIFT" : "VIP · NO GIFT") : "STANDARD";
};

export default function Scanner() {
  const [user, setUser] = useScannerSession();
  const [code, setCode] = useState("");
  const [screen, setScreen] = useState(null);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState({ admitted: 0, declined: 0 });
  const processingRef = useRef(false);

  // One scan = one atomic server check-in. No second confirmation tap, no offline admits.
  const handleCode = useCallback(async (raw) => {
    if (processingRef.current || !raw) return;
    processingRef.current = true;
    const clean = raw.trim().toUpperCase();
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
    <div className="min-h-screen bg-[#060609] text-white" data-testid="scanner-page">
      <ScanResultScreen screen={screen} onDismiss={() => { processingRef.current = false; setScreen(null); }} />
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between">
          <p className="font-display font-black uppercase text-sm sm:text-base">
            Door Control <span className="text-[#FF0055]">✦</span> <span className="text-[#00F0FF]">Našcanuj to, bráško</span>
          </p>
          <div className="flex items-center gap-4 font-mono2 text-xs text-slate-400">
            <span data-testid="scanner-stats">admitted {stats.admitted} · declined {stats.declined}</span>
            <button onClick={logout} data-testid="scanner-logout-button" className="hover:text-[#FF0055] transition-colors uppercase tracking-wider">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
        <CameraPanel cameraOn={cameraOn} onToggleCamera={toggle} code={code} setCode={setCode} onCheck={() => handleCode(code)} />
        <div className="flex flex-col gap-6">
          <div className="border border-white/10 rounded-2xl bg-[#0D0E15] p-6" data-testid="scanner-hint">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-3">Door rules</p>
            <ul className="space-y-2 font-mono2 text-xs text-slate-400">
              <li><span className="text-[#00F0FF] font-bold">STANDARD</span> — standard wristband, no gift</li>
              <li><span className="text-[#FFD400] font-bold">VIP</span> — VIP wristband; gift only when the screen says SURPRISE GIFT</li>
              <li><span className="text-[#FF0055] font-bold">DECLINED</span> — no wristband, no gift</li>
              <li>Each QR works exactly once — a second scan is declined.</li>
            </ul>
          </div>
          <DoorLog log={log} />
        </div>
      </div>
    </div>
  );
}
