import { Link } from "react-router-dom";

const FAQS = [
  { q: "Is there an age limit?", a: "Yes — the event is strictly 18+. Bring a valid ID or passport; every QR code is scanned and IDs are checked at the entrance." },
  { q: "When do doors open and when does it end?", a: "Doors open at 20:00 on 27.09.2026 and the night runs until 05:00." },
  { q: "What does one ticket include?", a: "One ticket gives you access to all three rooms: KPOP Room, Mainstream Room and Saigon Room." },
  { q: "What does VIP ALL ACCESS include?", a: "Everything in a standard ticket plus priority entrance, cloakroom included and VIP zone access in the Seoul Room." },
  { q: "Where exactly is DUPLEX?", a: "DUPLEX Prague, Václavské náměstí 831/21, 110 00 Praha 1 — on top of the building on Wenceslas Square. Metro Můstek is 2 minutes away." },
  { q: "Can I get a refund or transfer my ticket?", a: "Tickets are transferable — only the QR code is validated at the door. For refunds, email jalimaks@seznam.cz at least 7 days before the event. See Terms & Conditions for details." },
  { q: "I paid but didn't receive my tickets. What now?", a: "Check your spam folder first. If nothing arrived, email jalimaks@seznam.cz or call +420 774 384 616 and we'll resend your tickets." },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="faq-page">
      <header className="px-5 sm:px-10 h-16 flex items-center border-b border-white/10">
        <Link to="/" data-testid="faq-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-14">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">FAQ</p>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-10">Common questions</h1>
        <div className="space-y-7">
          {FAQS.map((f, i) => (
            <section key={i} data-testid={`faq-item-${i}`}>
              <h2 className="font-display font-bold text-sm sm:text-base uppercase mb-2 text-white/90">{f.q}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{f.a}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
