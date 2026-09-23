import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { Camera, CheckCircle2, ScanLine, XCircle } from "lucide-react";
import { api, formatError } from "@/api";
import AdminLogin from "@/components/AdminLogin";

function beep(ok) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = ok ? 880 : 200;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.15 : 0.4));
  } catch {}
}

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";

export default function Scanner() {
  const [user, setUser] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState({ scans: 0, admitted: 0 });
  const processingRef = useRef(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    // Session check with one silent refresh — keeps the scanner logged in through long events
    api.get("/auth/me").then((r) => setUser(r.data)).catch(async (e) => {
      if (e?.response?.status === 401) {
        try {
          await api.post("/auth/refresh");
          const r = await api.get("/auth/me");
          setUser(r.data);
          return;
        } catch {}
      }
      setUser(false);
    });
  }, []);

  useEffect(
    () => () => {
      scannerRef.current?.stop().catch(() => {});
    },
    []
  );

  // Transparently refresh the session once on 401 so door staff never get logged out mid-scan,
  // and retry once on transient failures (edge 429 / 5xx / network hiccup) before showing an error.
  const withRefresh = useCallback(async (fn) => {
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
  }, []);

  const handleCode = useCallback(async (raw) => {
    if (processingRef.current || !raw) return;
    processingRef.current = true;
    try {
      const r = await withRefresh(() => api.post("/scan/lookup", { code: raw }));
      setResult(r.data);
      const ok = r.data.result === "valid";
      beep(ok);
      setStats((s) => ({ ...s, scans: s.scans + 1 }));
      setLog((l) =>
        [{ code: raw.trim().toUpperCase(), result: r.data.result, at: new Date().toLocaleTimeString("cs-CZ") }, ...l].slice(0, 15)
      );
    } catch (e) {
      if (e?.response?.status === 401) setUser(false);
      else toast.error(formatError(e));
    } finally {
      setTimeout(() => {
        processingRef.current = false;
      }, 1200);
    }
  }, [withRefresh]);

  useEffect(() => {
    if (!result) return;
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

  const startCamera = async () => {
    try {
      const s = new Html5Qrcode("qr-reader");
      scannerRef.current = s;
      await s.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        (text) => handleCode(text),
        () => {}
      );
      setCameraOn(true);
    } catch {
      toast.error("Camera unavailable on this device — use manual code entry below.");
    }
  };

  const stopCamera = async () => {
    try {
      await scannerRef.current?.stop();
    } catch {}
    scannerRef.current = null;
    setCameraOn(false);
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
      />
    );

  const t = result?.ticket;
  const tn = (t?.tier_name || "").toUpperCase();
  const isGuest = t && /GUEST\s*LIST/.test(tn);
  const isGold = t && tn.includes("GOLD");
  const isAmbVip = t && tn === "AMBASSADOR VIP";
  const isAmbStd = t && tn === "AMBASSADOR STANDARD";
  const isVip = t && tn.includes("VIP") && !isGuest && !isGold && !isAmbVip;
  const bigBadgeCls = "mt-3 inline-flex items-center gap-2 rounded-2xl border-2 px-6 py-3 font-display font-black uppercase text-xl sm:text-2xl tracking-wider";
  const vipBadge = isVip && (
    <span
      data-testid="scan-vip-badge"
      className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#C9A227] bg-[#C9A227]/15 px-4 py-1.5 font-display font-black uppercase text-sm tracking-wider text-[#C9A227] shadow-[0_0_25px_rgba(201,162,39,0.35)]"
    >
      🏆 VIP Table
    </span>
  );
  const guestBadge = isGuest && (
    <span
      data-testid="scan-guest-badge"
      className={`${bigBadgeCls} border-[#C9A227] bg-[#C9A227] text-black shadow-[0_0_40px_rgba(201,162,39,0.55)]`}
    >
      🏆 VIP Guest List
    </span>
  );
  const goldBadge = isGold && (
    <span
      data-testid="scan-gold-badge"
      className={`${bigBadgeCls} border-[#d4af37] text-black shadow-[0_0_40px_rgba(212,175,55,0.55)]`}
      style={{ background: "linear-gradient(90deg, #b8912f, #f5d76e 50%, #d4af37)" }}
    >
      ◆ VIP GOLD
    </span>
  );
  const ambVipBadge = isAmbVip && (
    <span
      data-testid="scan-ambvip-badge"
      className={`${bigBadgeCls} border-[#C9A227] bg-[#C9A227] text-black shadow-[0_0_40px_rgba(201,162,39,0.55)]`}
    >
      🏆 Ambassador VIP
    </span>
  );
  const ambStdBadge = isAmbStd && (
    <span
      data-testid="scan-ambstd-badge"
      className="mt-3 inline-flex items-center gap-2 rounded-2xl border-2 border-[#00F0FF] bg-[#00F0FF]/15 px-5 py-2.5 font-display font-black uppercase text-lg tracking-wider text-[#00F0FF]"
    >
      ★ Ambassador
    </span>
  );

  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="scanner-page">
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between">
          <p className="font-display font-black uppercase text-sm sm:text-base">
            Door Control <span className="text-[#FF0055]">✦</span> <span className="text-[#00F0FF]">Našcanuj to, bráško</span>
          </p>
          <div className="flex items-center gap-4 font-mono2 text-xs text-slate-400">
            <span data-testid="scanner-stats">scans {stats.scans} · admitted {stats.admitted}</span>
            <button
              onClick={async () => { await api.post("/auth/logout").catch(() => {}); setUser(false); }}
              data-testid="scanner-logout-button"
              className="hover:text-[#FF0055] transition-colors uppercase tracking-wider"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-8 py-8 max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
        <div>
          <div className="relative border-2 border-dashed border-white/15 rounded-3xl overflow-hidden bg-[#0D0E15] min-h-[320px] flex items-center justify-center" data-testid="camera-viewport">
            <div id="qr-reader" className="w-full" />
            {cameraOn && (
              <div className="absolute inset-x-6 h-0.5 bg-[#FF0055] scan-laser neon-shadow pointer-events-none" />
            )}
            {!cameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
                <ScanLine size={40} className="text-slate-600" />
                <p className="font-mono2 text-xs text-slate-500 uppercase tracking-[0.25em]">Camera off</p>
              </div>
            )}
          </div>
          <button
            onClick={cameraOn ? stopCamera : startCamera}
            data-testid="camera-start-button"
            className={`mt-4 w-full flex items-center justify-center gap-2 font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 ${
              cameraOn
                ? "border border-white/20 hover:border-[#FF0055] hover:text-[#FF0055]"
                : "bg-[#00F0FF] text-black hover:bg-[#FFE600] cyan-shadow"
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
                onKeyDown={(e) => e.key === "Enter" && handleCode(code)}
              />
              <button
                onClick={() => handleCode(code)}
                data-testid="scan-check-button"
                className="shrink-0 bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm px-6 rounded-lg transition-colors duration-300"
              >
                Check
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div
            data-testid="scan-result-panel"
            className={`rounded-3xl border-2 p-8 min-h-[260px] flex flex-col justify-center transition-colors duration-300 ${
              !result
                ? "border-white/10 bg-[#0D0E15]"
                : result.result === "valid" || result.result === "admitted"
                ? "border-emerald-400 bg-emerald-400/10 shadow-[0_0_40px_rgba(52,211,153,0.25)]"
                : result.result === "refunded"
                ? "border-[#FF6A00] bg-[#FF6A00]/10 shadow-[0_0_40px_rgba(255,106,0,0.25)]"
                : "border-[#FF0055] bg-[#FF0055]/10 neon-shadow"
            }`}
          >
            {!result && (
              <p className="font-mono2 text-sm text-slate-500 text-center uppercase tracking-[0.25em]">
                Scan a ticket to validate
              </p>
            )}
            {result && result.result === "valid" && t && (
              <div data-testid="scan-result-valid">
                <CheckCircle2 size={44} className="text-emerald-400 mb-4" />
                <p className="font-display font-black text-3xl uppercase text-emerald-400 mb-3">Valid Ticket</p>
                <p className="font-mono2 text-sm text-white">{t.code}</p>
                <p className="text-slate-300 text-sm mt-1">{t.holder_name}</p>
                <p className="font-mono2 text-xs text-[#00F0FF] mt-1 uppercase tracking-wider">{t.tier_name}</p>
                {vipBadge}
                {guestBadge}
                {goldBadge}
                {ambVipBadge}
                {ambStdBadge}
                <button
                  onClick={checkin}
                  data-testid="checkin-button"
                  className="mt-6 w-full bg-emerald-400 text-black hover:bg-[#FFE600] font-display font-black uppercase text-base py-4 rounded-full transition-colors duration-300"
                >
                  Admit — Check In
                </button>
              </div>
            )}
            {result && result.result === "admitted" && t && (
              <div data-testid="scan-result-admitted">
                <CheckCircle2 size={44} className="text-emerald-400 mb-4" />
                <p className="font-display font-black text-3xl uppercase text-emerald-400 mb-3">Admitted — Checked In</p>
                <p className="font-mono2 text-sm text-white">{t.code}</p>
                <p className="text-slate-300 text-sm mt-1">{t.holder_name} · {t.tier_name}</p>
                {vipBadge}
                {guestBadge}
                {goldBadge}
                {ambVipBadge}
                {ambStdBadge}
                <p className="font-mono2 text-xs text-slate-400 mt-2">Ticket is now marked as used. Scan the next guest.</p>
              </div>
            )}
            {result && result.result === "refunded" && t && (
              <div data-testid="scan-result-refunded">
                <XCircle size={44} className="text-[#FF6A00] mb-4" />
                <p className="font-display font-black text-3xl uppercase text-[#FF6A00] mb-3">Refunded / Cancelled</p>
                <p className="font-mono2 text-sm text-white">{t.code}</p>
                <p className="font-mono2 text-sm text-slate-400 mt-2">This order was refunded or cancelled. Do not admit.</p>
              </div>
            )}
            {result && result.result === "used" && t && (
              <div data-testid="scan-result-used">
                <XCircle size={44} className="text-[#FFE600] mb-4" />
                <p className="font-display font-black text-3xl uppercase text-[#FFE600] mb-3">Already Used</p>
                <p className="font-mono2 text-sm text-white">{t.code}</p>
                <p className="text-slate-300 text-sm mt-1">{t.holder_name} · {t.tier_name}</p>
                {vipBadge}
                {guestBadge}
                {goldBadge}
                {ambVipBadge}
                {ambStdBadge}
                <p className="font-mono2 text-xs text-slate-400 mt-2">
                  Checked in at {t.checked_in_at ? new Date(t.checked_in_at).toLocaleString("cs-CZ") : "—"}
                  {t.checked_in_by ? ` by ${t.checked_in_by}` : ""}
                </p>
              </div>
            )}
            {result && result.result === "invalid" && (
              <div data-testid="scan-result-invalid">
                <XCircle size={44} className="text-[#FF0055] mb-4" />
                <p className="font-display font-black text-3xl uppercase text-[#FF0055] mb-3">Invalid Ticket</p>
                <p className="font-mono2 text-sm text-slate-400">This code does not exist. Do not admit.</p>
              </div>
            )}
          </div>

          <div className="border border-white/10 rounded-2xl bg-[#0D0E15] p-5" data-testid="scan-log">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-3">Door log</p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {log.map((l, i) => (
                <div key={i} className="flex items-center justify-between font-mono2 text-xs" data-testid={`scan-log-entry-${i}`}>
                  <span className="text-slate-300">{l.code}</span>
                  <span className={l.result === "valid" ? "text-emerald-400" : l.result === "used" ? "text-[#FFE600]" : "text-[#FF0055]"}>
                    {l.result.toUpperCase()}
                  </span>
                  <span className="text-slate-600">{l.at}</span>
                </div>
              ))}
              {log.length === 0 && <p className="font-mono2 text-xs text-slate-600">No scans yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
