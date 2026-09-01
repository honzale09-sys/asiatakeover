import { useEffect, useState } from "react";
import Lenis from "lenis";
import { Link } from "react-router-dom";
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
    instagram: "@asiatakeover.prague",
  },
};

function UpcomingEvents({ event }) {
  return (
    <section id="events" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28" data-testid="upcoming-events">
      <Reveal>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-10 lg:mb-14">
          Upcoming <span className="text-[#FF6A00]">Events</span>
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <Link to="/tickets" data-testid="event-card" className="group block max-w-sm">
          <div className="relative rounded-2xl overflow-hidden border border-white/10">
            <span className="absolute top-3 left-3 z-10 bg-[#FF6A00] text-white font-mono2 text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded" data-testid="event-card-tag">
              Festival
            </span>
            <img
              src="/assets/logo-atf-round.jpg"
              alt={event?.name || "ASIA TAKEOVER FESTIVAL"}
              className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="mt-5">
            <h3 className="font-display font-bold uppercase text-lg leading-snug">{event?.name || "ASIA TAKEOVER FESTIVAL 2026"}</h3>
            <p className="font-mono2 text-xs text-slate-400 mt-2 tracking-[0.15em] uppercase">
              {event?.date_label || "27.09.2026"} · {event?.venue || "DUPLEX"} · {event?.city || "Prague"}
            </p>
            <p className="font-mono2 text-xs text-[#00F0FF] mt-2.5 tracking-[0.15em] uppercase group-hover:text-white transition-colors">
              Get tickets →
            </p>
          </div>
        </Link>
      </Reveal>
    </section>
  );
}

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

function About() {
  return (
    <section id="about" className="px-4 sm:px-8 lg:px-16 py-16 lg:py-24" data-testid="about-section">
      <Reveal>
        <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-4">About Us</p>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mb-6 max-w-2xl leading-tight">
          Prague's biggest Asian <span className="text-[#FF0055]">festival</span> experience
        </h2>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
          ASIA TAKEOVER takes over DUPLEX Prague for a full night across three rooms — K-POP, mainstream hits and
          Vinahouse — presented by DUPLEX × SEOULVIBES × GANGSHII.
        </p>
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
      <UpcomingEvents event={data.event} />
      <MapSection />
      <About />
      <Footer />
    </div>
  );
}
