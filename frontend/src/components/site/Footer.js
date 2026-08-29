export default function Footer({ event, content }) {
  return (
    <footer
      className="border-t border-white/10 px-5 sm:px-10 py-14 flex flex-col items-center text-center gap-8"
      data-testid="footer"
    >
      <div className="flex items-center gap-6 opacity-80">
        <img src="/assets/logo-gangshii.png" alt="GANGSHII" className="h-4 object-contain" />
        <img src="/assets/logo-duplex-clean.png" alt="DUPLEX" className="h-5 object-contain" />
        <img src="/assets/logo-seoulvibes.jpg" alt="Seoul Vibes" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/30" />
      </div>
      <div className="font-mono2 text-xs text-white/50 space-y-2 tracking-[0.15em] uppercase">
        <p data-testid="footer-address">
          {event?.date_label || "27.09.2026"} · {event?.venue || "DUPLEX"},{" "}
          {event?.address || "Václavské náměstí 831/21, Praha 1"}
        </p>
        <p>
          <a href={`mailto:${content?.contact_email || "jalimaks@seznam.cz"}`} className="hover:text-white transition-colors" data-testid="footer-email-link">
            {content?.contact_email || "jalimaks@seznam.cz"}
          </a>
          {"  ·  "}
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" data-testid="footer-instagram-link">
            {content?.instagram || "@asiatakeover.prague"}
          </a>
        </p>
      </div>
      <div className="flex gap-6 font-mono2 text-[10px] uppercase tracking-[0.25em] text-white/30">
        <a href="/contact" data-testid="footer-contact-link" className="hover:text-white transition-colors">Contact</a>
        <a href="/terms" data-testid="footer-terms-link" className="hover:text-white transition-colors">Terms</a>
        <a href="/nascanujtobrasko" data-testid="footer-scanner-link" className="hover:text-white transition-colors">Door Staff</a>
        <a href="/admin" data-testid="footer-admin-link" className="hover:text-white transition-colors">Admin</a>
      </div>
      <p className="font-mono2 text-[10px] text-white/25">© 2026 Asia Takeover Festival · Demo ticketing — no real payments processed.</p>
    </footer>
  );
}
