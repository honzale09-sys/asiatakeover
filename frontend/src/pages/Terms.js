import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Identifikace prodávajícího",
    body: "Prodávajícím a pořadatelem akce ASIA TAKEOVER FESTIVAL je podnikatel, IČO: 22156879. Kontakt: e-mail hello@asiatakeover.com, telefon +420 774 384 616. Akce se koná 27. září 2026 v klubu DUPLEX, Václavské náměstí 831/21, 110 00 Praha 1. Tyto obchodní podmínky upravují vztah mezi prodávajícím a zákazníkem při nákupu vstupenek prostřednictvím webu asiatakeover.cz.",
  },
  {
    title: "2. Předmět smlouvy",
    body: "Předmětem smlouvy je vstupenka (vstupové oprávnění) na akci ASIA TAKEOVER FESTIVAL dne 27. 9. 2026. Jedna vstupenka opravňuje k jednomu vstupu jedné osoby a je platná ve všech třech stagech akce (Seoul Floor, Mainstream Floor, Saigon Floor). Vstupenky jsou přenositelné — při vstupu se ověřuje pouze QR kód, nikoliv jméno.",
  },
  {
    title: "3. Objednávka a uzavření smlouvy",
    body: "Zákazník vybere typ a počet vstupenek, vyplní jméno a e-mail a odešle objednávku. Smlouva je uzavřena okamžikem přijetí platby prodávajícím. Po potvrzení platby jsou zákazníkovi vstupenky automaticky zaslány e-mailem a zpřístupněny na potvrzovací stránce objednávky.",
  },
  {
    title: "4. Ceny a platební podmínky",
    body: "Všechny ceny jsou uvedeny v českých korunách (CZK) včetně DPH, je-li prodávající plátcem DPH. Platba probíhá online prostřednictvím platební brány Teya (platební karty a další metody dle nabídky brány) se zabezpečením 3-D Secure. Údaje o platební kartě zadává zákazník výhradně v zabezpečeném prostředí platební brány Teya; prodávající k nim nemá přístup a nikam je neukládá.",
  },
  {
    title: "5. Doručení vstupenek",
    body: "Vstupenky jsou doručovány elektronicky na e-mail uvedený v objednávce bezprostředně po úspěšném zaplacení. Každá vstupenka obsahuje unikátní QR kód. Pokud e-mail nedorazí, zkontrolujte prosím složku Spam a případně nás kontaktujte na hello@asiatakeover.com nebo +420 774 384 616 — vstupenky vám obratem přeposíláme.",
  },
  {
    title: "6. Odstoupení od smlouvy — NO REFUND POLICY",
    body: "Vstupenka je službou v oblasti volného času s pevně stanoveným termínem konání, proto na ni podle § 1837 písm. l) občanského zákoníku NEPLATÍ právo na odstoupení od smlouvy ve 14denní lhůtě. Všechny vstupenky jsou NEVRATNÉ (no refund) — zaplacenou vstupenku nelze vrátit ani vyměnit a prodávající neposkytuje žádné dobrovolné vrácení peněz. Vstupenku však můžete volně převést na jinou osobu — u vstupu se ověřuje pouze QR kód, nikoliv jméno. Plnou náhradu vstupného poskytujeme pouze v případě, že pořadatel akci zruší jako celek.",
  },
  {
    title: "7. Reklamace a vrácení peněz",
    body: "Reklamace (např. nedoručené nebo nefunkční vstupenky, chybně stržená částka) zasílejte na hello@asiatakeover.com nebo volejte +420 774 384 616. Reklamaci vyřídíme bez zbytečného odkladu, nejpozději do 30 dnů. Při zrušení akce pořadatelem budou všechny vstupenky plně refundovány na původní platební metodu. Refundované vstupenky jsou zneplatněny a nelze s nimi vstoupit na akci.",
  },
  {
    title: "8. Vstupní podmínky",
    body: "Akce je přísně 18+. Při vstupu je vyžadován platný průkaz totožnosti. Každý QR kód umožňuje jeden vstup; po oskenuvání se vstupenka označí jako použitá a opakovaný vstup není možný. Nešiřte své QR kódy veřejně — kdokoliv s platným nepoužitým QR kódem může být vpuštěn. Pořadatel si vyhrazuje právo odepřít vstup v souladu s návštěvním řádem klubu DUPLEX.",
  },
  {
    title: "9. Změny programu",
    body: "Změny programu, časů vystoupení nebo obsazení sálů nejsou důvodem k vrácení vstupného, ledaže byla akce zrušena jako celek.",
  },
  {
    title: "10. Ochrana osobních údajů",
    body: "Osobní údaje (jméno, e-mail) zpracováváme pouze pro vyřízení objednávky, doručení vstupenek a komunikaci k akci, v souladu s nařízením GDPR. Platební údaje zpracovává výhradně platební brána Teya. Marketingové účely (Meta Pixel) pouze s vaším souhlasem, který lze kdykoli odvolat.",
  },
  {
    title: "11. Mimosoudní řešení sporů",
    body: "Případné spory lze řešit mimosoudní cestou u České obchodní inspekce (www.coi.cz). Tyto podmínky se řídí právem České republiky.",
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
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">Právní informace</p>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-4">Obchodní podmínky</h1>
        <div className="border border-white/10 rounded-2xl bg-[#0D0E15] p-5 mb-10" data-testid="terms-seller-info">
          <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Prodávající / pořadatel</p>
          <p className="text-sm text-slate-300 leading-relaxed">
            IČO: 22156879<br />
            E-mail: hello@asiatakeover.com<br />
            Telefon: +420 774 384 616<br />
            Místo konání: DUPLEX, Václavské náměstí 831/21, 110 00 Praha 1
          </p>
        </div>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display font-bold text-sm sm:text-base uppercase mb-2 text-white/90">{s.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="font-mono2 text-[11px] text-slate-600 mt-12 leading-relaxed" data-testid="terms-legal-note">
          Pozn.: Před spuštěním prodeje doplň do bodu 1 celé jméno/název a bydliště/sídlo podnikatele (dle IČO v rejstříku)
          a nech text zkontrolovat právníkem. Platnost od: 27. 8. 2026.
        </p>
      </main>
    </div>
  );
}
