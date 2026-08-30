import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/api";

export default function Lockdown({ children }) {
  const [enabled, setEnabled] = useState(null);
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem("atf_unlocked") === "1");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/gate/status")
      .then((r) => {
        setEnabled(r.data.enabled);
        if (!r.data.enabled) window.dispatchEvent(new Event("atf-unlock"));
      })
      .catch(() => setEnabled(true));
  }, []);

  if (enabled === null) return <div className="min-h-screen bg-white" data-testid="lockdown-loading" />;
  if (enabled === false) return children;
  if (unlocked) return children;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await api.post("/gate", { password });
      localStorage.setItem("atf_unlocked", "1");
      window.dispatchEvent(new Event("atf-unlock"));
      setUnlocked(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6" data-testid="lockdown-page">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center"
      >
        <div className="flex items-center justify-center gap-6 sm:gap-8 mb-10 sm:mb-12" data-testid="lockdown-partner-logos">
          <img src="/assets/logo-gangshii-dark.png" alt="GANGSHII" className="h-4 sm:h-5 object-contain" />
          <span className="w-px h-4 bg-black/15" />
          <img src="/assets/logo-duplex-dark.png" alt="DUPLEX The Rooftop Club" className="h-5 sm:h-6 object-contain" />
          <span className="w-px h-4 bg-black/15" />
          <img src="/assets/logo-seoulvibes.jpg" alt="Seoul Vibes" className="h-7 sm:h-8 w-7 sm:w-8 rounded-full object-cover ring-1 ring-black/10" />
        </div>

        <img
          src="/assets/logo-atf-dark.png"
          alt="ASIA TAKEOVER FESTIVAL"
          data-testid="lockdown-logo"
          className="w-[70vw] max-w-[420px] object-contain"
        />

        <form onSubmit={submit} className="mt-12 sm:mt-16 flex flex-col items-center">
          <label htmlFor="lockdown-password" className="font-mono2 text-[11px] uppercase tracking-[0.35em] text-black/50 mb-4">
            Enter Password
          </label>
          <input
            id="lockdown-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="lockdown-password-input"
            autoFocus
            className="w-64 sm:w-72 bg-transparent text-center text-black font-mono2 text-sm tracking-[0.2em] border-b border-black/25 focus:border-black outline-none py-3 transition-colors"
          />
          {error && (
            <p className="font-mono2 text-[11px] text-red-600 mt-4 tracking-[0.2em] uppercase" data-testid="lockdown-error">
              Wrong password
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            data-testid="lockdown-submit-button"
            className="mt-8 font-mono2 text-xs uppercase tracking-[0.3em] text-black border border-black/25 hover:bg-black hover:text-white rounded-full px-10 py-3.5 transition-colors duration-300 disabled:opacity-50"
          >
            {busy ? "…" : "Enter"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
