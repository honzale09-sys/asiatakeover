import { useEffect, useState } from "react";
import Lenis from "lenis";
import { api } from "@/api";
import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import Gallery from "@/components/site/Gallery";
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
    capacity: 1500,
  },
  tiers: [
    { id: "fb1", name: "Early Bird", price_czk: 490, capacity: 300, sold: 0, description: "First wave — cheapest entry, all floors.", perks: ["Entry to all 3 floors + 2 rooftops", "Access to both photobooth zones", "Soju welcome shot"] },
    { id: "fb2", name: "General Admission", price_czk: 690, capacity: 800, sold: 0, description: "Full festival access, all night long.", perks: ["Entry to all 3 floors + 2 rooftops", "Access to both photobooth zones", "Open until 05:00"] },
    { id: "fb3", name: "VIP Sky Lounge", price_czk: 1490, capacity: 250, sold: 0, description: "Elevated views over Wenceslas Square.", perks: ["VIP zone + sky terrace access", "Welcome soju cocktail", "Separate VIP entrance", "Cloakroom included"] },
    { id: "fb4", name: "Ultra VIP Table", price_czk: 4990, capacity: 50, sold: 0, description: "Private table for you and your crew.", perks: ["Private table (up to 4 guests)", "Bottle service included", "Priority photobooth access", "Dedicated host"] },
  ],
  content: {
    contact_email: "info@asiatakeover.eu",
    instagram: "@asiatakeover.prague",
  },
};

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

  return (
    <div className="relative bg-[#060609] text-white min-h-screen" data-testid="landing-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <Navbar />
      <Hero event={data.event} />
      <Gallery />
      <Footer event={data.event} content={data.content} />
    </div>
  );
}
