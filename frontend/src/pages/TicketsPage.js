import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/api";
import { trackEvent } from "@/lib/tracking";
import Tickets from "@/components/site/Tickets";
import { LangPicker } from "@/components/site/Navbar";
import { useT } from "@/i18n";

export default function TicketsPage() {
  const [site, setSite] = useState(null);
  const [failed, setFailed] = useState(false);
  const { t, lp } = useT();
  const [params] = useSearchParams();
  const refParam = params.get("ref");
  if (refParam) localStorage.setItem("atf_ref", refParam.trim().toUpperCase());
  const refCode = (refParam || localStorage.getItem("atf_ref") || "").trim().toUpperCase() || null;

  useEffect(() => {
    api
      .get("/site")
      .then((r) => setSite(r.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (site) {
      trackEvent("ViewContent", {
        content_ids: (site.tiers || []).map((t) => t.id),
        content_type: "product",
        content_name: site.event?.name,
        currency: "CZK",
      });
    }
  }, [site]);

  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="tickets-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <header className="px-5 sm:px-10 h-16 flex items-center justify-between border-b border-white/10">
        <Link to={lp("/")} data-testid="tickets-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
        <div className="flex items-center gap-4 opacity-80">
          <img src="/assets/logo-gangshii.png" alt="GANGSHII" className="h-3.5 object-contain hidden sm:block" />
          <img src="/assets/logo-duplex-clean.png" alt="DUPLEX" className="h-4 object-contain hidden sm:block" />
          <img src="/assets/logo-seoulvibes.jpg" alt="Seoul Vibes" className="h-6 w-6 rounded-full object-cover ring-1 ring-white/30 hidden sm:block" />
          <LangPicker />
        </div>
      </header>
      {site ? (
        <Tickets tiers={site.tiers} event={site.event} refCode={refCode} />
      ) : (
        <p className="px-5 py-24 text-center font-mono2 text-xs uppercase tracking-[0.3em] text-white/40" data-testid="tickets-loading">
          {failed ? t("tickets.unavailable") : t("tickets.loading")}
        </p>
      )}
    </div>
  );
}
