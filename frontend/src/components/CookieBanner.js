import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/api";
import { getConsent, saveConsent } from "@/lib/tracking";
import { useT } from "@/i18n";

export default function CookieBanner() {
  const { t } = useT();
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(() => !getConsent());
  const [unlocked, setUnlocked] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    const check = () => {
      api
        .get("/gate/status")
        .then((r) => {
          if (!r.data.enabled) return setUnlocked(true);
          const s = r.data.since || 0;
          setUnlocked(
            localStorage.getItem("atf_unlocked") === "1" &&
              Number(localStorage.getItem("atf_unlocked_at") || 0) >= s
          );
        })
        .catch(() => setUnlocked(localStorage.getItem("atf_unlocked") === "1"));
    };
    check();
    const h = () => setUnlocked(true);
    window.addEventListener("atf-unlock", h);
    return () => window.removeEventListener("atf-unlock", h);
  }, []);

  if (!unlocked) return null;
  if (pathname.startsWith("/admin") || pathname.startsWith("/nascanujtobrasko")) return null;
  if (!visible) return null;

  const choose = (a, m) => {
    saveConsent({ analytics: a, marketing: m });
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] px-4 pb-4" data-testid="cookie-banner">
      <div className="max-w-3xl mx-auto glass border border-white/15 rounded-2xl p-5 sm:p-6">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{t("cookies.title")}</p>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {t("cookies.text")}
        </p>
        {customizing && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 font-mono2 text-xs text-slate-300">
            <label className="flex items-center gap-2 opacity-60">
              <input type="checkbox" checked disabled className="accent-[#FF0055]" /> {t("cookies.necessary")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="accent-[#FF0055]" data-testid="cookie-analytics-toggle" /> {t("cookies.analytics")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="accent-[#FF0055]" data-testid="cookie-marketing-toggle" /> {t("cookies.marketing")}
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => choose(true, true)}
            data-testid="cookie-accept-all-button"
            className="bg-[#FF6A00] hover:bg-[#FF8534] text-white font-mono2 text-xs font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
          >
            {t("cookies.acceptAll")}
          </button>
          {customizing ? (
            <button
              onClick={() => choose(analytics, marketing)}
              data-testid="cookie-save-button"
              className="border border-white/25 hover:border-white font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
            >
              {t("cookies.save")}
            </button>
          ) : (
            <button
              onClick={() => setCustomizing(true)}
              data-testid="cookie-customize-button"
              className="border border-white/25 hover:border-white font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
            >
              {t("cookies.customize")}
            </button>
          )}
          <button
            onClick={() => choose(false, false)}
            data-testid="cookie-reject-button"
            className="text-slate-400 hover:text-white font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 transition-colors"
          >
            {t("cookies.reject")}
          </button>
        </div>
      </div>
    </div>
  );
}
