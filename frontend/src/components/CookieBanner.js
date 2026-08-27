import { useState } from "react";
import { useLocation } from "react-router-dom";
import { getConsent, saveConsent } from "@/lib/tracking";

export default function CookieBanner() {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(() => !getConsent());
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  if (pathname.startsWith("/admin") || pathname.startsWith("/nascanujtobrasko")) return null;
  if (!visible) return null;

  const choose = (a, m) => {
    saveConsent({ analytics: a, marketing: m });
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[70] px-4 pb-4" data-testid="cookie-banner">
      <div className="max-w-3xl mx-auto glass border border-white/15 rounded-2xl p-5 sm:p-6">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-[#00F0FF] mb-2">Cookies</p>
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          We use necessary cookies to run the site and process your order. With your permission we also use
          analytics and marketing cookies (Meta Pixel) to measure how our ads perform. You can refuse optional
          cookies and still buy tickets.
        </p>
        {customizing && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4 font-mono2 text-xs text-slate-300">
            <label className="flex items-center gap-2 opacity-60">
              <input type="checkbox" checked disabled className="accent-[#FF0055]" /> Necessary (always on)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="accent-[#FF0055]" data-testid="cookie-analytics-toggle" /> Analytics
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="accent-[#FF0055]" data-testid="cookie-marketing-toggle" /> Marketing / Meta Pixel
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => choose(true, true)}
            data-testid="cookie-accept-all-button"
            className="bg-[#FF6A00] hover:bg-[#FF8534] text-white font-mono2 text-xs font-bold uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
          >
            Accept all
          </button>
          {customizing ? (
            <button
              onClick={() => choose(analytics, marketing)}
              data-testid="cookie-save-button"
              className="border border-white/25 hover:border-white font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
            >
              Save selection
            </button>
          ) : (
            <button
              onClick={() => setCustomizing(true)}
              data-testid="cookie-customize-button"
              className="border border-white/25 hover:border-white font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-full transition-colors"
            >
              Customize
            </button>
          )}
          <button
            onClick={() => choose(false, false)}
            data-testid="cookie-reject-button"
            className="text-slate-400 hover:text-white font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 transition-colors"
          >
            Reject optional
          </button>
        </div>
      </div>
    </div>
  );
}
