import { useState } from "react";
import { Link } from "react-router-dom";

const FAQS = {
  en: [
    { q: "Is there an age limit?", a: "Yes — the event is strictly 18+. Bring a valid ID or passport; every QR code is scanned and IDs are checked at the entrance." },
    { q: "When does the event start and when does it end?", a: "The festival runs from 22:00 to 05:00 on 27.09.2026." },
    { q: "What does one ticket include?", a: "One ticket gives you access to all three stages: Seoul Floor (7th floor, powered by SeoulVibes), Mainstream Floor (6th floor) and Saigon Floor (5th floor, powered by GANGSHII) — plus standing and dance floor access and all public bars. VIP areas are not included." },
    { q: "What does VIP ALL ACCESS include?", a: "Access to all 3 stages, priority fast lane entry, access to all VIP areas, VIP toilets, a special gift, bottle service available, and 7th floor K-POP stage balcony access with tables." },
    { q: "Where exactly is DUPLEX?", a: "DUPLEX Prague, Václavské náměstí 831/21, 110 00 Praha 1 — on top of the building on Wenceslas Square. Metro Můstek is 2 minutes away." },
    { q: "Can I get a refund or transfer my ticket?", a: "Tickets are non-refundable. You can freely transfer your ticket to someone else — only the QR code is validated at the door, never the name. If the event is cancelled by the organizer, all tickets are fully refunded automatically." },
    { q: "I paid but didn't receive my tickets. What now?", a: "Check your spam folder first. If nothing arrived, email hello@asiatakeover.com and we'll resend your tickets." },
  ],
  cz: [
    { q: "Je na akci věkový limit?", a: "Ano — akce je přísně 18+. Vezmi si platný občanský průkaz nebo pas; každý QR kód se skenuje a u vstupu kontrolujeme doklady." },
    { q: "Kdy akce začíná a kdy končí?", a: "Festival probíhá od 22:00 do 05:00 dne 27. 9. 2026." },
    { q: "Co všechno vstupenka obsahuje?", a: "Jedna vstupenka ti otevírá všechny tři stage: Seoul Floor (7. patro, powered by SeoulVibes), Mainstream Floor (6. patro) a Saigon Floor (5. patro, powered by GANGSHII) — plus vstup na taneční parket a ke všem veřejným barům. VIP zóny nejsou součástí." },
    { q: "Co obsahuje VIP ALL ACCESS?", a: "Vstup na všechny 3 stage, přednostní rychlý vstup, přístup do všech VIP zón, VIP toalety, speciální dárek, možnost bottle service a přístup na balkón se stoly u K-POP stage v 7. patře." },
    { q: "Kde přesně je DUPLEX?", a: "DUPLEX Prague, Václavské náměstí 831/21, 110 00 Praha 1 — na střeše budovy na Václavském náměstí. Metro Můstek je 2 minuty pěšky." },
    { q: "Můžu vrátit nebo převést vstupenku?", a: "Vstupenky se nevrací (no refund). Vstupenku ale můžeš volně převést na někoho jiného — u dveří se ověřuje pouze QR kód, nikdy ne jméno. Pokud akci zruší pořadatel, všem automaticky vracíme plnou částku." },
    { q: "Zaplatil/a jsem, ale vstupenky mi nepřišly. Co teď?", a: "Nejdřív zkontroluj složku Spam. Pokud nic nedorazilo, napiš na hello@asiatakeover.com a vstupenky ti obratem přepošleme." },
  ],
};

export default function FaqPage() {
  const [lang, setLang] = useState("en");
  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="faq-page">
      <header className="px-5 sm:px-10 h-16 flex items-center justify-between border-b border-white/10">
        <Link to="/" data-testid="faq-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
        <div className="flex gap-2" data-testid="faq-lang-toggle">
          {["en", "cz"].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              data-testid={`faq-lang-${l}`}
              className={`font-mono2 text-[11px] uppercase tracking-[0.2em] rounded-full px-4 py-1.5 border transition-colors ${
                lang === l ? "bg-white text-black border-white" : "border-white/20 text-white/60 hover:text-white"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-14">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">FAQ</p>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-10">
          {lang === "en" ? "Common questions" : "Časté dotazy"}
        </h1>
        <div className="space-y-7">
          {FAQS[lang].map((f, i) => (
            <section key={`${lang}-${i}`} data-testid={`faq-item-${i}`}>
              <h2 className="font-display font-bold text-sm sm:text-base uppercase mb-2 text-white/90">{f.q}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{f.a}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
