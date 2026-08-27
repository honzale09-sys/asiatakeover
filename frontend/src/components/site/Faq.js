import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal, SectionHead } from "./Reveal";

const FAQS = [
  {
    q: "Is there an age limit?",
    a: "Yes — the festival is strictly 18+. Bring a valid ID or passport; door staff scan every ticket and check IDs at the entrance.",
  },
  {
    q: "When do doors open and when does it end?",
    a: "Doors open at 20:00 on 27.09.2026 and the takeover runs until 05:00. Last entry is at 02:00.",
  },
  {
    q: "Is there a dress code?",
    a: "No strict dress code — but neon, streetwear and your best Seoul-inspired fit are strongly encouraged. You'll want to look good in the photobooth zones.",
  },
  {
    q: "What do VIP tickets include?",
    a: "VIP Sky Lounge gets you the sky terrace, a separate fast entrance and a welcome soju cocktail. Ultra VIP Table adds a private table for up to 4 guests, bottle service, priority photobooth access and a dedicated host.",
  },
  {
    q: "Where are the photobooth zones?",
    a: "Two photobooth zones: one on the K-POP Sky Terrace and one in the Soju Rooftop Lounge. Unlimited shots all night with every ticket.",
  },
  {
    q: "Soju — what's the deal?",
    a: "Dedicated soju bars run all night on both rooftops, with flavours flown in for the festival. Early Bird tickets include a welcome shot.",
  },
  {
    q: "Where exactly is DUPLEX?",
    a: "DUPLEX Prague, Václavské náměstí 831/21, 110 00 Praha 1 — right on Wenceslas Square, on top of the building. Metro Můstek is 2 minutes away.",
  },
  {
    q: "Can I get a refund or transfer my ticket?",
    a: "Tickets are transferable — the name doesn't need to match, only the QR code is scanned. For refunds, contact us at least 7 days before the event.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28 bg-[#0B0C12] border-y border-white/5" data-testid="faq-section">
      <Reveal>
        <SectionHead kicker="04 / The Details" title="Questions," accent="Answered" />
      </Reveal>
      <div className="max-w-3xl space-y-3" data-testid="faq-accordion">
        {FAQS.map((f, i) => (
          <Reveal key={i} delay={i * 0.04}>
            <div className="border border-white/10 rounded-2xl bg-[#0D0E15] overflow-hidden" data-testid={`faq-item-${i}`}>
              <button
                data-testid={`faq-question-${i}`}
                onClick={() => setOpen(open === i ? -1 : i)}
                className="w-full flex items-center justify-between gap-4 text-left px-6 py-5 hover:text-[#FFE600] transition-colors"
              >
                <span className="font-display font-bold text-sm sm:text-base uppercase">{f.q}</span>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-[#FF0055] transition-transform duration-300 ${open === i ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-500 ${open === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-sm text-slate-400 leading-relaxed" data-testid={`faq-answer-${i}`}>{f.a}</p>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
