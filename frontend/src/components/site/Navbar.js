import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

const linkCls =
  "font-mono2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70 hover:text-white transition-colors";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="absolute top-0 left-0 right-0 z-40" data-testid="navbar">
      <div className="px-4 sm:px-10 h-16 flex items-center justify-between sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <nav className="hidden sm:flex items-center gap-8 justify-start sm:order-1">
          <Link to="/tickets" data-testid="nav-events-link" className={linkCls}>
            Events
          </Link>
          <a href="/#gallery" onClick={(e) => { e.preventDefault(); go("gallery"); }} data-testid="nav-gallery-link" className={linkCls}>
            Gallery
          </a>
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
            Contact
          </Link>
        </nav>
        <button
          className="sm:hidden text-white/80 hover:text-white transition-colors"
          onClick={() => setOpen(!open)}
          data-testid="nav-menu-button"
          aria-label="Menu"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="sm:hidden glass border-t border-white/10 px-6 py-5 flex flex-col gap-5" data-testid="nav-mobile-menu">
          <Link to="/tickets" onClick={() => setOpen(false)} data-testid="nav-mobile-events-link" className={linkCls}>
            Events
          </Link>
          <a
            href="/#gallery"
            onClick={(e) => { e.preventDefault(); setOpen(false); go("gallery"); }}
            data-testid="nav-mobile-gallery-link"
            className={linkCls}
          >
            Gallery
          </a>
          <Link to="/contact" onClick={() => setOpen(false)} data-testid="nav-mobile-contact-link" className={linkCls}>
            Contact
          </Link>
        </div>
      )}
    </header>
  );
}
