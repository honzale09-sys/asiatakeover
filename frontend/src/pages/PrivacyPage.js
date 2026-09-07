import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "Správce osobních údajů",
    body: "Správcem osobních údajů je pořadatel akce ASIA TAKEOVER FESTIVAL — NGUYEN TRUONG AN, Benkova 177/6, Chodov, Praha 11, IČO: 22156879, kontakt: hello@asiatakeover.com.",
  },
  {
    title: "Jaké údaje zpracováváme a proč",
    body: "Jméno a e-mail — pro vyřízení objednávky, doručení vstupenek a komunikaci k akci (plnění smlouvy). Platební údaje zpracovává výhradně platební brána Teya — k údajům o kartě nemáme přístup. Technické údaje (IP adresa, prohlížeč) — pro zabezpečení plateb a ochranu proti zneužití.",
  },
  {
    title: "Marketingové měření (Meta Pixel)",
    body: "S vaším souhlasem používáme Meta Pixel pro měření účinnosti reklam na Facebooku a Instagramu. Souhlas udělíte nebo odmítnete v cookie liště a můžete ho kdykoli změnit. Bez souhlasu se marketingové měření nespouští.",
  },
  {
    title: "Cookies",
    body: "Používáme nezbytné cookies pro fungování webu a nákupu vstupenek. Analytické a marketingové cookies pouze se souhlasem.",
  },
  {
    title: "Vaše práva",
    body: "Máte právo na přístup k údajům, opravu, výmaz, omezení zpracování, přenositelnost a právo podat stížnost u Úřadu pro ochranu osobních údajů (www.uoou.cz). Kontakt: hello@asiatakeover.com.",
  },
  {
    title: "Doba uchování",
    body: "Údaje k objednávkám uchováváme po dobu nezbytnou pro plnění smlouvy a zákonné účetní povinnosti.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="privacy-page">
      <header className="px-5 sm:px-10 h-16 flex items-center border-b border-white/10">
        <Link to="/" data-testid="privacy-back-link" className="font-display font-black text-[11px] sm:text-xs tracking-[0.3em] uppercase hover:opacity-60 transition-opacity">
          ← Asia Takeover
        </Link>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-14">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">Právní informace</p>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl uppercase mb-10">Zásady ochrany osobních údajů</h1>
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h2 className="font-display font-bold text-sm sm:text-base uppercase mb-2 text-white/90">{s.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="font-mono2 text-[11px] text-slate-600 mt-12 leading-relaxed">
          Pozn.: Před spuštěním prodeje nech text zkontrolovat právníkem a doplň sídlo správce dle IČO.
        </p>
      </main>
    </div>
  );
}
