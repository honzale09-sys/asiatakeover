import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import AdminLogin from "@/components/AdminLogin";
import { ScanResultPanel } from "@/components/scanner/ScanResultPanel";
import { CameraPanel, DoorLog } from "@/components/scanner/ScannerPanels";
import { beep } from "@/components/scanner/scanUtils";

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

// Transparently refresh the session once on 401 so door staff never get logged out mid-scan,
// and retry once on transient failures (edge 429 / 5xx / network hiccup) before showing an error.
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

export default function Scanner() {
  const [user, setUser] = useScannerSession();
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState({ scans: 0, admitted: 0 });
  const processingRef = useRef(false);

  const handleCode = useCallback(async (raw) => {
    if (processingRef.current || !raw) return;
    processingRef.current = true;
    try {
      const r = await withRefresh(() => api.post("/scan/lookup", { code: raw }));
      setResult(r.data);
      beep(r.data.result === "valid");
      setStats((s) => ({ ...s, scans: s.scans + 1 }));
      setLog((l) =>
        [{ id: `${Date.now()}-${l.length}`, code: raw.trim().toUpperCase(), result: r.data.result, at: new Date().toLocaleTimeString("cs-CZ") }, ...l].slice(0, 15)
      );
    } catch (e) {
      if (e?.response?.status === 401) setUser(false);
      else toast.error(formatError(e));
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 1200);
    }
  }, [setUser]);

  const { cameraOn, toggle } = useCamera(handleCode);

  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  const checkin = async () => {
    if (!result?.ticket) return;
    try {
      const r = await withRefresh(() => api.post("/scan/checkin", { code: result.ticket.code }));
      if (r.data.result === "valid") {
        setResult({ ...r.data, result: "admitted" });
        beep(true);
        setStats((s) => ({ ...s, admitted: s.admitted + 1 }));
        toast.success(`${r.data.ticket.holder_name} admitted`);
      } else {
        setResult(r.data);
        beep(false);
      }
    } catch (e) {
      toast.error(formatError(e));
    }
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
    <div className="min-h-screen bg-[#060609] text-white" data-testid="scanner-page">
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between">
          <p className="font-display font-black uppercase text-sm sm:text-base">
            Door Control <span className="text-[#FF0055]">✦</span> <span className="text-[#00F0FF]">Našcanuj to, bráško</span>
          </p>
          <div className="flex items-center gap-4 font-mono2 text-xs text-slate-400">
            <span data-testid="scanner-stats">scans {stats.scans} · admitted {stats.admitted}</span>
            <button onClick={logout} data-testid="scanner-logout-button" className="hover:text-[#FF0055] transition-colors uppercase tracking-wider">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
        <CameraPanel cameraOn={cameraOn} onToggleCamera={toggle} code={code} setCode={setCode} onCheck={() => handleCode(code)} />
        <div className="flex flex-col gap-6">
          <ScanResultPanel result={result} onCheckin={checkin} />
          <DoorLog log={log} />
        </div>
      </div>
    </div>
  );
}
