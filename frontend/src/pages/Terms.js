import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Organizer & Event",
    body: "ASIA TAKEOVER FESTIVAL takes place on 27 September 2026 at DUPLEX, Václavské náměstí 831/21, 110 00 Praha 1, Czech Republic. The event is presented by DUPLEX × SEOULVIBES × GANGSHII. Organizer identification details (company name, IČO) will be listed here before the start of ticket sales.",
  },
  {
    title: "2. Tickets",
    body: "Each QR code represents one individual entry. Tickets are transferable — the name on the order does not need to match the person entering, only the QR code is validated at the door. Do not share your QR codes publicly; anyone holding a valid unused QR code may be granted entry.",
  },
  {
    title: "3. Age limit & entry conditions",
    body: "The event is strictly 18+. A valid ID or passport is required at the entrance. The organizer reserves the right to refuse entry in line with the venue's house rules.",
  },
  {
    title: "4. Payments",
    body: "Online payments are processed securely by the GoPay payment gateway. We never see or store your card details. Prices are in CZK and include VAT where applicable.",
  },
  {
    title: "5. Refunds & cancellation",
    body: "Tickets are refundable up to 7 days before the event upon request sent to our contact email. If the event is cancelled, all tickets are fully refunded to the original payment method. Refunded tickets are invalidated and cannot be used for entry.",
  },
  {
    title: "6. Programme changes",
    body: "The lineup, programme times and room assignments may change. Such changes do not constitute grounds for a refund unless the event is cancelled entirely.",
  },
  {
    title: "7. Liability",
    body: "Visitors attend at their own risk. The organizer is not liable for lost or stolen personal belongings. Cloakroom service is provided by the venue.",
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="terms-page">
      <header className="px-5 sm:px-10 h-16 flex items-center border-b border-white/10">
        <Link to="/" data-testid="terms-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-14">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">Legal</p>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-10">Terms & Conditions</h1>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display font-bold text-sm sm:text-base uppercase mb-2 text-white/90">{s.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="font-mono2 text-[11px] text-slate-600 mt-12 leading-relaxed" data-testid="terms-legal-note">
          This text is a working template and must be reviewed by the organizer's legal advisor before production use.
        </p>
      </main>
    </div>
  );
}
