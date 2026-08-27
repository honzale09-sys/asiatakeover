export default function Footer() {
  return (
    <footer className="border-t border-white/10 px-4 sm:px-8 lg:px-16 py-12" data-testid="footer">
      <div className="flex flex-col lg:flex-row justify-between gap-8">
        <div>
          <p className="font-display font-black text-xl uppercase">
            Asia Takeover <span className="text-[#FF0055]">✦</span> Fest
          </p>
          <p className="font-mono2 text-xs text-slate-500 mt-2 tracking-[0.2em] uppercase">
            DUPLEX × SEOULVIBES × GANGSHII
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 font-mono2 text-xs uppercase tracking-[0.2em] text-slate-400">
          <a href="/nascanujtobrasko" data-testid="footer-scanner-link" className="hover:text-[#00F0FF] transition-colors">Door Staff</a>
          <a href="/admin" data-testid="footer-admin-link" className="hover:text-[#00F0FF] transition-colors">Admin</a>
        </div>
      </div>
      <p className="font-mono2 text-[11px] text-slate-600 mt-10">© 2026 Asia Takeover Festival · Prague · Demo ticketing — no real payments processed.</p>
    </footer>
  );
}
