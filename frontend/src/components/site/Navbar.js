import { Link } from "react-router-dom";

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

const linkCls =
  "font-mono2 text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white/70 hover:text-white transition-colors";

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40" data-testid="navbar">
      <div className="px-4 sm:px-10 h-16 grid grid-cols-[1fr_auto_1fr] items-center">
        <nav className="flex items-center gap-4 sm:gap-8 justify-start">
          <a href="/#events" onClick={(e) => { e.preventDefault(); go("events"); }} data-testid="nav-events-link" className={linkCls}>
            Events
          </a>
          <a href="/#gallery" onClick={(e) => { e.preventDefault(); go("gallery"); }} data-testid="nav-gallery-link" className={linkCls}>
            Gallery
          </a>
        </nav>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} data-testid="nav-logo" className="justify-self-center">
          <img src="/assets/logo-atf-round.jpg" alt="ASIA TAKEOVER" className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover" />
        </button>
        <nav className="flex items-center gap-4 sm:gap-8 justify-end">
          <Link to="/contact" data-testid="nav-contact-link" className={linkCls}>
            Contact
          </Link>
          <a href="/#about" onClick={(e) => { e.preventDefault(); go("about"); }} data-testid="nav-about-link" className={linkCls}>
            About Us
          </a>
        </nav>
      </div>
    </header>
  );
}
