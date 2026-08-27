const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Navbar() {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 mix-blend-difference"
      data-testid="navbar"
    >
      <div className="px-5 sm:px-10 h-14 flex items-center justify-between text-white">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase"
          data-testid="nav-logo"
        >
          Asia Takeover
        </button>
        <button
          onClick={() => go("tickets")}
          data-testid="nav-buy-tickets-button"
          className="font-mono2 text-[11px] sm:text-xs uppercase tracking-[0.3em] hover:opacity-60 transition-opacity"
        >
          Tickets
        </button>
      </div>
    </header>
  );
}
