import { useState } from "react";
import { Link } from "react-router-dom";
import { Mic2, Play } from "lucide-react";
import { Reveal } from "@/components/site/Reveal";

const sectionCls = "px-4 sm:px-8 lg:px-16 py-16 lg:py-24";

function SectionHead({ eyebrow, titleA, titleB, testid }) {
  return (
    <>
      <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-4">{eyebrow}</p>
      <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight mb-10" data-testid={testid}>
        {titleA} <span className="text-[#FF0055]">{titleB}</span>
      </h2>
    </>
  );
}

export function WatchTheTakeover() {
  return (
    <section className={`${sectionCls} bg-[#060609]`} data-testid="watch-the-takeover-section">
      <Reveal>
        <SectionHead eyebrow="Aftermovies & recaps" titleA="Watch the" titleB="Takeover" testid="watch-the-takeover-title" />
        <div className="grid gap-5 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="aspect-video rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex items-center justify-center"
              data-testid={`takeover-video-slot-${n}`}
            >
              <span className="font-display text-6xl sm:text-7xl font-extrabold text-white/10 select-none">X</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const STAGES = [
  { id: "seoul", num: "01", name: "Seoul Floor", desc: "Powered by SeoulVibes", floor: "7th Floor", logo: "/assets/logo-seoulvibes.jpg", round: true },
  { id: "mainstream", num: "02", name: "Mainstream Floor", desc: "Classic DUPLEX experience", floor: "6th Floor", logo: "/assets/logo-duplex-clean.png", round: false },
  { id: "saigon", num: "03", name: "Saigon Floor", desc: "Powered by GANGSHII", floor: "5th Floor", logo: "/assets/logo-gangshii.png", round: false },
];

export function ExploreStages() {
  return (
    <section className={`${sectionCls} bg-[#0B0C12] border-y border-white/5`} data-testid="explore-stages-section">
      <Reveal>
        <SectionHead eyebrow="One ticket, three worlds" titleA="Explore" titleB="3 Stages" testid="explore-stages-title" />
        <div className="grid gap-5 sm:grid-cols-3">
          {STAGES.map((s) => (
            <div
              key={s.id}
              className="group rounded-2xl border border-white/10 bg-[#060609] p-7 sm:p-8 transition-colors duration-300 hover:border-[#FF0055]/50"
              data-testid={`stage-card-${s.id}`}
            >
              <div className="flex items-start justify-between mb-10">
                <span className="font-display text-4xl font-extrabold text-white/10 group-hover:text-[#FF0055]/40 transition-colors">{s.num}</span>
                <span className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-white/50 border border-white/15 rounded-full px-3 py-1.5" data-testid={`stage-floor-${s.id}`}>
                  {s.floor}
                </span>
              </div>
              <img
                src={s.logo}
                alt={s.name}
                className={`mb-6 object-contain ${s.round ? "h-12 w-12 rounded-full ring-1 ring-white/20" : "h-8"}`}
                data-testid={`stage-logo-${s.id}`}
              />
              <h3 className="font-display text-xl sm:text-2xl font-extrabold uppercase tracking-tight mb-2" data-testid={`stage-name-${s.id}`}>
                {s.name}
              </h3>
              <p className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-500" data-testid={`stage-desc-${s.id}`}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

const LINEUP_TABS = [
  { id: "seoul", label: "Seoul" },
  { id: "mainstream", label: "Mainstream" },
  { id: "gangshii", label: "Gangshii" },
];

export function WhoPlays() {
  const [active, setActive] = useState("seoul");
  return (
    <section className={`${sectionCls} bg-[#060609]`} data-testid="who-plays-section">
      <Reveal>
        <SectionHead eyebrow="Lineup" titleA="Who plays" titleB="— and when?" testid="who-plays-title" />
        <div className="flex flex-wrap gap-3 mb-10" data-testid="who-plays-tabs">
          {LINEUP_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              data-testid={`who-plays-tab-${t.id}`}
              className={`font-mono2 text-xs uppercase tracking-[0.25em] rounded-full px-7 py-3 border transition-colors duration-300 ${
                active === t.id
                  ? "bg-[#FF0055] border-[#FF0055] text-white"
                  : "border-white/20 text-white/60 hover:text-white hover:border-white/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5" data-testid={`dj-grid-${active}`}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={`${active}-${n}`}
              className="aspect-square rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-3"
              data-testid={`dj-placeholder-${active}-${n}`}
            >
              <Mic2 size={26} className="text-white/20" />
              <span className="font-mono2 text-[10px] uppercase tracking-[0.25em] text-white/30">DJ TBA</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function InsideDuplex() {
  return (
    <section className={`${sectionCls} bg-[#0B0C12] border-y border-white/5`} data-testid="inside-duplex-section">
      <Reveal>
        <SectionHead eyebrow="From the sky" titleA="Inside" titleB="Duplex" testid="inside-duplex-title" />
        <div
          className="aspect-video w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-4"
          data-testid="inside-duplex-video-slot"
        >
          <span className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center">
            <Play size={22} className="text-white/40 ml-1" />
          </span>
          <span className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-white/30">Drone footage coming soon</span>
        </div>
      </Reveal>
    </section>
  );
}

export function BuyTicketsCta() {
  return (
    <section className={`${sectionCls} bg-[#1F050D] text-center`} data-testid="buy-tickets-cta-section">
      <Reveal>
        <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-5">27.09.2026 • DUPLEX Prague</p>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold uppercase tracking-tight mb-10" data-testid="buy-tickets-cta-title">
          Ready for the <span className="text-[#FF0055]">Takeover?</span>
        </h2>
        <Link
          to="/tickets"
          data-testid="buy-tickets-cta-button"
          className="inline-flex items-center justify-center bg-[#FF6A00] hover:bg-[#FF7A1A] text-white font-display font-bold uppercase tracking-[0.15em] text-sm sm:text-base rounded-full px-12 py-5 transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)]"
        >
          Buy Tickets
        </Link>
      </Reveal>
    </section>
  );
}
