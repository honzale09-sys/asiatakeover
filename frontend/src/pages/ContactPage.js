import { Link } from "react-router-dom";
import { Instagram, Mail, MapPin } from "lucide-react";
import { useT } from "@/i18n";

export default function ContactPage() {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="contact-page">
      <header className="px-5 sm:px-10 h-16 flex items-center border-b border-white/10">
        <Link to="/" data-testid="contact-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-14">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{t("contact.eyebrow")}</p>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-10">{t("contact.title")}</h1>
        <div className="space-y-4">
          <a
            href="mailto:hello@asiatakeover.com"
            data-testid="contact-email-card"
            className="flex items-center gap-4 border border-white/10 rounded-2xl bg-[#0D0E15] p-6 hover:border-[#FF0055]/60 transition-colors"
          >
            <Mail size={22} className="text-[#FF0055] shrink-0" />
            <div>
              <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("contact.email")}</p>
              <p className="font-medium mt-1">hello@asiatakeover.com</p>
            </div>
          </a>
          <a
            href="https://instagram.com/asiatakeover_prague"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="contact-instagram-card"
            className="flex items-center gap-4 border border-white/10 rounded-2xl bg-[#0D0E15] p-6 hover:border-[#00F0FF]/60 transition-colors"
          >
            <Instagram size={22} className="text-[#00F0FF] shrink-0" />
            <div>
              <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("contact.instagram")}</p>
              <p className="font-medium mt-1">@asiatakeover_prague</p>
            </div>
          </a>
          <div className="flex items-center gap-4 border border-white/10 rounded-2xl bg-[#0D0E15] p-6" data-testid="contact-venue-card">
            <MapPin size={22} className="text-[#FF6A00] shrink-0" />
            <div>
              <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500">{t("contact.venue")}</p>
              <p className="font-medium mt-1">DUPLEX · Václavské náměstí 831/21, 110 00 Praha 1</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-10 leading-relaxed">
          {t("contact.note")}
        </p>
        <p className="font-mono2 text-[11px] text-slate-600 mt-6" data-testid="contact-company-info">
          Provozovatel: NGUYEN TRUONG AN · IČO 22156879 · hello@asiatakeover.com
        </p>
      </main>
    </div>
  );
}
