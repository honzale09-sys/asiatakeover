import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Lenis from "lenis";
import { api } from "@/api";
import Navbar from "@/components/site/Navbar";
import Hero from "@/components/site/Hero";
import Footer from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { WatchTheTakeover, ExploreStages, WhoPlays, InsideDuplex, BuyTicketsCta } from "@/components/site/HomeSections";

const FALLBACK = {
  event: {
    id: "fallback",
    name: "ASIA TAKEOVER FESTIVAL 2026",
    date: "2026-09-27T22:00:00+02:00",
    date_label: "27.09.2026",
    venue: "DUPLEX",
    city: "Prague",
    address: "Václavské náměstí 831/21, 110 00 Praha 1",
    capacity: 1500,
  },
  tiers: [],
  content: {
    contact_email: "hello@asiatakeover.com",
    instagram: "@asiatakeover_prague",
  },
};

function UpcomingEvents({ event }) {
  return (
    <section className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16 bg-[#0B0C12] border-y border-white/5" data-testid="upcoming-events-section">
      <Reveal>
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">Save the date</p>
        <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-tight mb-8">
          Upcoming <span className="text-[#FF0055]">Events</span>
        </h2>
        <Link
          to="/tickets"
          data-testid="upcoming-event-poster-link"
          className="group block w-full max-w-xs"
        >
          <span className="relative block rounded-2xl overflow-hidden border border-white/10 transition-transform duration-300 group-hover:-translate-y-1">
            <img
              src="/assets/poster-festival.jpg"
              alt={`${event?.name || "ASIA TAKEOVER FESTIVAL"} — 27.09.2026, DUPLEX Prague`}
              className="w-full aspect-[4/5] object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              data-testid="upcoming-event-poster"
            />
            <span className="absolute top-3 left-3 font-mono2 text-[10px] uppercase tracking-[0.2em] bg-[#FF0055] text-white px-2.5 py-1 rounded-md" data-testid="upcoming-event-badge">
              Festival
            </span>
          </span>
          <span className="mt-4 flex items-center justify-between gap-4">
            <span className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-white/60" data-testid="upcoming-event-meta">
              {event?.date_label || "27.09.2026"} <span className="text-[#FF0055]">•</span> {event?.venue || "DUPLEX"} {event?.city || "Prague"}
            </span>
            <span className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-[#FF6A00] whitespace-nowrap group-hover:text-white transition-colors" data-testid="upcoming-event-cta">
              Get Tickets →
            </span>
          </span>
        </Link>
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
      <WatchTheTakeover />
      <ExploreStages />
      <WhoPlays />
      <InsideDuplex />
      <BuyTicketsCta />
      <Footer />
    </div>
  );
}
