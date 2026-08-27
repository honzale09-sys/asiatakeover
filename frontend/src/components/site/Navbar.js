import { Zap } from "lucide-react";

const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Navbar({ dateLabel }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/10" data-testid="navbar">
      <div className="px-4 sm:px-8 lg:px-16 h-16 flex items-center justify-between">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="font-display font-black text-sm sm:text-base tracking-tight uppercase"
          data-testid="nav-logo"
        >
          Asia Takeover <span className="text-[#FF0055]">✦</span> Fest
        </button>
        <nav className="hidden md:flex items-center gap-8 font-mono2 text-xs uppercase tracking-[0.2em] text-slate-300">
          <button data-testid="nav-lineup-link" onClick={() => go("lineup")} className="hover:text-[#00F0FF] transition-colors">Lineup</button>
          <button data-testid="nav-floors-link" onClick={() => go("floors")} className="hover:text-[#00F0FF] transition-colors">Floors</button>
          <button data-testid="nav-tickets-link" onClick={() => go("tickets")} className="hover:text-[#00F0FF] transition-colors">Tickets</button>
          <button data-testid="nav-faq-link" onClick={() => go("faq")} className="hover:text-[#00F0FF] transition-colors">FAQ</button>
          <button data-testid="nav-contact-link" onClick={() => go("contact")} className="hover:text-[#00F0FF] transition-colors">Contact</button>
        </nav>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block font-mono2 text-xs text-[#FFE600] tracking-[0.2em]">{dateLabel}</span>
          <button
            onClick={() => go("tickets")}
            data-testid="nav-buy-tickets-button"
            className="flex items-center gap-2 bg-[#FF0055] hover:bg-[#FFE600] hover:text-black text-white font-mono2 text-xs font-bold uppercase tracking-[0.15em] px-4 py-2.5 rounded-full transition-colors duration-300 neon-shadow"
          >
            <Zap size={14} /> Buy Tickets
          </button>
        </div>
      </div>
    </header>
  );
}
