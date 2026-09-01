import { useEffect, useState } from "react";
import Lenis from "lenis";
import { api } from "@/api";
import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import Footer from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";

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
  tiers: [],
  content: {
    contact_email: "jalimaks@seznam.cz",
    instagram: "@asiatakeover_prague",
  },
};

function MapSection() {
  return (
    <section id="gallery" className="px-4 sm:px-8 lg:px-16 py-16 lg:py-24 bg-[#0B0C12] border-y border-white/5" data-testid="map-section">
      <Reveal>
        <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-4">Gallery</p>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight mb-4">
          The <span className="text-[#FF0055]">Map</span>
        </h2>
        <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-8">
          KPOP Room <span className="text-[#FF0055]">•</span> Mainstream Room <span className="text-[#FF0055]">•</span> Saigon Room
        </p>
        <img
          src="/assets/floorplan.png"
          alt="DUPLEX floor map — KPOP Room, Mainstream Room, Saigon Room"
          className="w-full rounded-2xl border border-white/10"
          data-testid="map-image"
        />
      </Reveal>
    </section>
  );
}

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
      <Hero event={data.event} tiers={data.tiers} />
      <MapSection />
      <Footer />
    </div>
  );
}
