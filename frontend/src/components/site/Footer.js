import { Link } from "react-router-dom";
import { Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#0B0C12]" data-testid="footer">
      <div className="px-4 sm:px-8 lg:px-16 py-14 grid gap-12 sm:grid-cols-3">
        <div>
          <img src="/assets/logo-atf-round.jpg" alt="ASIA TAKEOVER" className="h-12 w-12 rounded-full object-cover mb-5" />
          <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
            Prague's biggest Asian festival experience. Three rooms, one ticket, unforgettable nights.
          </p>
        </div>
        <div>
          <p className="font-display font-bold text-sm uppercase mb-5">Quick Links</p>
          <ul className="space-y-3 text-sm text-slate-400">
            <li><Link to="/faq" data-testid="footer-faq-link" className="hover:text-white transition-colors">FAQ</Link></li>
            <li><Link to="/terms" data-testid="footer-terms-link" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
            <li><Link to="/privacy" data-testid="footer-privacy-link" className="hover:text-white transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" data-testid="footer-refund-link" className="hover:text-white transition-colors">Refund Policy</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-display font-bold text-sm uppercase mb-5">Follow Us</p>
          <a
            href="https://instagram.com/asiatakeover_prague"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-instagram-link"
            className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-white/15 text-slate-300 hover:border-[#FF6A00] hover:text-[#FF6A00] transition-colors"
          >
            <Instagram size={18} />
          </a>
          <p className="font-mono2 text-[11px] text-slate-600 mt-6">© 2026 ASIA TAKEOVER. All rights reserved.</p>
        </div>
      </div>
      <div className="px-4 sm:px-8 lg:px-16 pb-8 flex flex-wrap gap-6 font-mono2 text-[10px] uppercase tracking-[0.25em] text-white/25">
        <a href="/nascanujtobrasko" data-testid="footer-scanner-link" className="hover:text-white transition-colors">Door Staff</a>
        <a href="/admin" data-testid="footer-admin-link" className="hover:text-white transition-colors">Admin</a>
      </div>
    </footer>
  );
}
