import { useEffect, useState } from "react";
import Lenis from "lenis";
import { api } from "@/api";
import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import Marquee from "@/components/site/Marquee";
import Lineup from "@/components/site/Lineup";
import Floors from "@/components/site/Floors";
import Tickets from "@/components/site/Tickets";
import Faq from "@/components/site/Faq";
import Contact from "@/components/site/Contact";
import Footer from "@/components/site/Footer";

const FALLBACK = {
  event: {
    id: "fallback",
    name: "ASIA TAKEOVER FESTIVAL 2026",
    date: "2026-09-27T20:00:00+02:00",
    date_label: "27.09.2026",
    venue: "DUPLEX",
    city: "Prague",
    address: "Václavské náměstí 831/21, 110 00 Praha 1",
    presented_by: "DUPLEX × SEOULVIBES × GANGSHII",
    capacity: 1500,
    genres: ["K-POP", "HipHop/RnB", "Vinahouse", "J-POP", "Pop Hits", "Choreography Dance"],
    lineup: [
      { name: "DJ GANGSHII", genre: "Pop Hits", stage: "Main Stage", time: "02:00", origin: "Seoul" },
      { name: "SEOULKISS", genre: "K-POP", stage: "K-POP Sky Terrace", time: "23:00", origin: "Seoul" },
      { name: "HANA BEATS", genre: "K-POP", stage: "Main Stage", time: "21:00", origin: "Tokyo" },
      { name: "MC RYU", genre: "HipHop/RnB", stage: "Main Stage", time: "00:00", origin: "Osaka" },
      { name: "DJ SABLE", genre: "HipHop/RnB", stage: "Soju Rooftop Lounge", time: "22:00", origin: "London" },
      { name: "VIETKONG", genre: "Vinahouse", stage: "Vinahouse Vault", time: "01:00", origin: "Ho Chi Minh City" },
      { name: "DJ LOTUS", genre: "Vinahouse", stage: "Vinahouse Vault", time: "23:30", origin: "Hanoi" },
      { name: "TOKYO NOVA", genre: "J-POP", stage: "K-POP Sky Terrace", time: "20:00", origin: "Tokyo" },
      { name: "SAKURA WAVE", genre: "J-POP", stage: "Soju Rooftop Lounge", time: "21:30", origin: "Kyoto" },
      { name: "GANGSHII DANCE CREW", genre: "Choreography Dance", stage: "Main Stage", time: "22:30", origin: "Prague × Seoul" },
    ],
  },
  tiers: [
    { id: "fb1", name: "Early Bird", price_czk: 490, capacity: 300, sold: 0, description: "First wave — cheapest entry, all floors.", perks: ["Entry to all 3 floors + 2 rooftops", "Access to both photobooth zones", "Soju welcome shot"] },
    { id: "fb2", name: "General Admission", price_czk: 690, capacity: 800, sold: 0, description: "Full festival access, all night long.", perks: ["Entry to all 3 floors + 2 rooftops", "Access to both photobooth zones", "Open until 05:00"] },
    { id: "fb3", name: "VIP Sky Lounge", price_czk: 1490, capacity: 250, sold: 0, description: "Elevated views over Wenceslas Square.", perks: ["VIP zone + sky terrace access", "Welcome soju cocktail", "Separate VIP entrance", "Cloakroom included"] },
    { id: "fb4", name: "Ultra VIP Table", price_czk: 4990, capacity: 50, sold: 0, description: "Private table for you and your crew.", perks: ["Private table (up to 4 guests)", "Bottle service included", "Priority photobooth access", "Dedicated host"] },
  ],
  content: {
    announcement: "EARLY BIRD TICKETS LIVE NOW — 27.09.2026 — DUPLEX PRAGUE",
    hero_sub: "The biggest Asian festival in Prague. 3 floors. 10 international DJs. 2 rooftops. One night only.",
    contact_email: "info@asiatakeover.eu",
    instagram: "@asiatakeover.prague",
  },
};

const MARQUEE_ITEMS = [
  "27.09.2026",
  "DUPLEX PRAGUE",
  "K-POP",
  "HIPHOP / RNB",
  "VINAHOUSE",
  "J-POP",
  "POP HITS",
  "CHOREOGRAPHY DANCE",
  "SOJU",
  "3 FLOORS",
  "2 ROOFTOPS",
  "10 INTERNATIONAL DJS",
  "2 PHOTOBOOTH ZONES",
];

export default function Landing() {
  const [site, setSite] = useState(null);

  useEffect(() => {
    api
      .get("/site")
      .then((r) => setSite(r.data))
      .catch(() => setSite(FALLBACK));
  }, []);

  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let raf;
    const loop = (time) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  const data = site || FALLBACK;
  const sold = (data.tiers || []).reduce((s, t) => s + (t.sold || 0), 0);

  return (
    <div className="relative bg-[#060609] text-white min-h-screen" data-testid="landing-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <Navbar dateLabel={data.event?.date_label} />
      <Hero event={data.event} content={data.content} sold={sold} capacity={data.event?.capacity} />
      <Marquee items={[data.content?.announcement, ...MARQUEE_ITEMS].filter(Boolean)} />
      <Lineup lineup={data.event?.lineup} genres={data.event?.genres} />
      <Floors />
      <Tickets tiers={data.tiers} event={data.event} />
      <Faq />
      <Contact event={data.event} content={data.content} />
      <Footer />
    </div>
  );
}
