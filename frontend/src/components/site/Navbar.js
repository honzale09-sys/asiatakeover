import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Globe } from "lucide-react";
import { useT, LANGS } from "@/i18n";

const linkCls =
  "font-mono2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70 hover:text-white transition-colors";

export function LangPicker({ mobile = false }) {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" data-testid={mobile ? "lang-picker-mobile" : "lang-picker"}>
      <button
        onClick={() => setOpen(!open)}
        data-testid={mobile ? "lang-picker-mobile-button" : "lang-picker-button"}
        className="flex items-center gap-1.5 font-mono2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/70 hover:text-white border border-white/15 hover:border-white/40 rounded-full px-3 py-1.5 transition-colors"
        aria-label="Language"
      >
        <Globe size={13} /> {LANGS.find((l) => l.code === lang)?.label || "EN"}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 glass border border-white/15 rounded-xl py-2 min-w-[110px] z-50" data-testid="lang-picker-menu">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              data-testid={`lang-option-${l.code}`}
              className={`block w-full text-left px-4 py-2 font-mono2 text-xs uppercase tracking-[0.15em] transition-colors ${
                lang === l.code ? "text-[#FF6A00]" : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { t } = useT();
  return (
    <header className="absolute top-0 left-0 right-0 z-40" data-testid="navbar">
      <div className="px-4 sm:px-10 h-16 flex items-center justify-between sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <nav className="hidden sm:flex items-center gap-8 justify-start sm:order-1">
          <Link to="/tickets" data-testid="nav-events-link" className={linkCls}>
            {t("nav.events")}
          </Link>
          <Link to="/gallery" data-testid="nav-gallery-link" className={linkCls}>
            {t("nav.gallery")}
          </Link>
        </nav>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          data-testid="nav-logo"
          className="sm:order-2 sm:justify-self-center"
        >
          <img src="/assets/logo-atf-round.jpg" alt="ASIA TAKEOVER" className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover" />
        </button>
        <nav className="hidden sm:flex items-center gap-8 justify-end sm:order-3">
          <Link to="/contact" data-testid="nav-contact-link" className={linkCls}>
            {t("nav.contact")}
          </Link>
          <LangPicker />
        </nav>
        <div className="sm:hidden flex items-center gap-3">
          <LangPicker mobile />
          <button
            className="text-white/80 hover:text-white transition-colors"
            onClick={() => setOpen(!open)}
            data-testid="nav-menu-button"
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="sm:hidden glass border-t border-white/10 px-6 py-5 flex flex-col gap-5" data-testid="nav-mobile-menu">
          <Link to="/tickets" onClick={() => setOpen(false)} data-testid="nav-mobile-events-link" className={linkCls}>
            {t("nav.events")}
          </Link>
          <Link to="/gallery" onClick={() => setOpen(false)} data-testid="nav-mobile-gallery-link" className={linkCls}>
            {t("nav.gallery")}
          </Link>
          <Link to="/contact" onClick={() => setOpen(false)} data-testid="nav-mobile-contact-link" className={linkCls}>
            {t("nav.contact")}
          </Link>
        </div>
      )}
    </header>
  );
}
