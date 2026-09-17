import { useState } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/site/Reveal";
import { useT } from "@/i18n";

const sectionCls = "px-4 sm:px-8 lg:px-16 py-12 lg:py-16";

function SectionHead({ eyebrow, titleA, titleB, testid }) {
  return (
    <>
      <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-3">{eyebrow}</p>
      <h2 className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-tight mb-8" data-testid={testid}>
        {titleA} <span className="text-[#FF0055]">{titleB}</span>
      </h2>
    </>
  );
}

const TAKEOVER_VIDEOS = [
  { src: "/assets/takeover-1.mp4", poster: "/assets/takeover-1.jpg" },
  { src: "/assets/takeover-2.mp4", poster: "/assets/takeover-2.jpg" },
  { src: "/assets/takeover-3.mp4", poster: "/assets/takeover-3.jpg" },
];

export function WatchTheTakeover() {
  const { t } = useT();
  return (
    <section className={`${sectionCls} bg-[#060609]`} data-testid="watch-the-takeover-section">
      <Reveal>
        <SectionHead eyebrow={t("home.watchEyebrow")} titleA={t("home.watchA")} titleB={t("home.watchB")} testid="watch-the-takeover-title" />
        <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-3xl">
          {TAKEOVER_VIDEOS.map((v, i) => (
            <div key={i} className="aspect-[9/16] rounded-2xl overflow-hidden border border-white/10 bg-black" data-testid={`takeover-video-slot-${i + 1}`}>
              <video
                src={v.src}
                poster={v.poster}
                controls
                playsInline
                preload="none"
                className="w-full h-full object-contain"
                data-testid={`takeover-video-${i + 1}`}
              />
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function ExploreStages() {
  const { t } = useT();
  const STAGES = [
    { id: "seoul", num: "01", name: t("stage.seoul.name"), desc: t("stage.seoul.desc"), floor: t("stage.seoul.floor"), logo: "/assets/logo-seoulvibes.jpg", round: true },
    { id: "mainstream", num: "02", name: t("stage.main.name"), desc: t("stage.main.desc"), floor: t("stage.main.floor"), logo: "/assets/logo-duplex-clean.png", round: false },
    { id: "saigon", num: "03", name: t("stage.saigon.name"), desc: t("stage.saigon.desc"), floor: t("stage.saigon.floor"), logo: "/assets/logo-gangshii.png", round: false },
  ];
  return (
    <section className={`${sectionCls} bg-[#0B0C12] border-y border-white/5`} data-testid="explore-stages-section">
      <Reveal>
        <SectionHead eyebrow={t("home.stagesEyebrow")} titleA={t("home.stagesA")} titleB={t("home.stagesB")} testid="explore-stages-title" />
        <div className="grid gap-5 sm:grid-cols-3">
          {STAGES.map((s) => (
            <div
              key={s.id}
              className="group rounded-2xl border border-white/10 bg-[#060609] p-5 sm:p-6 transition-colors duration-300 hover:border-[#FF0055]/50"
              data-testid={`stage-card-${s.id}`}
            >
              <div className="flex items-start justify-between mb-7">
                <span className="font-display text-3xl font-extrabold text-white/10 group-hover:text-[#FF0055]/40 transition-colors">{s.num}</span>
                <span className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-white/50 border border-white/15 rounded-full px-2.5 py-1" data-testid={`stage-floor-${s.id}`}>
                  {s.floor}
                </span>
              </div>
              <img
                src={s.logo}
                alt={s.name}
                className={`mb-4 object-contain ${s.round ? "h-10 w-10 rounded-full ring-1 ring-white/20" : "h-6"}`}
                data-testid={`stage-logo-${s.id}`}
              />
              <h3 className="font-display text-base sm:text-lg font-extrabold uppercase tracking-tight mb-1.5" data-testid={`stage-name-${s.id}`}>
                {s.name}
              </h3>
              <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-500" data-testid={`stage-desc-${s.id}`}>
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
  { id: "seoul", label: "Seoul", poster: "/assets/lineup-seoul.jpg" },
  { id: "mainstream", label: "Mainstream", poster: "/assets/lineup-mainstream.jpg" },
  { id: "gangshii", label: "Gangshii", poster: "/assets/lineup-saigon.jpg" },
];

export function WhoPlays() {
  const [active, setActive] = useState("seoul");
  const { t } = useT();
  const tab = LINEUP_TABS.find((x) => x.id === active);
  return (
    <section className={`${sectionCls} bg-[#060609]`} data-testid="who-plays-section">
      <Reveal>
        <SectionHead eyebrow={t("home.lineupEyebrow")} titleA={t("home.whoA")} titleB={t("home.whoB")} testid="who-plays-title" />
        <div className="flex flex-nowrap gap-2 mb-8" data-testid="who-plays-tabs">
          {LINEUP_TABS.map((x) => (
            <button
              key={x.id}
              onClick={() => setActive(x.id)}
              data-testid={`who-plays-tab-${x.id}`}
              className={`whitespace-nowrap font-mono2 text-[10px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] rounded-full px-4 py-2 sm:px-6 sm:py-2.5 border transition-colors duration-300 ${
                active === x.id
                  ? "bg-[#FF0055] border-[#FF0055] text-white"
                  : "border-white/20 text-white/60 hover:text-white hover:border-white/50"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex justify-center" data-testid={`dj-grid-${active}`}>
          <img
            src={tab.poster}
            alt={`${tab.label} stage — full lineup`}
            className="w-full max-w-xs rounded-2xl border border-white/10"
            loading="lazy"
            data-testid={`lineup-poster-${active}`}
          />
        </div>
      </Reveal>
    </section>
  );
}

export function InsideDuplex() {
  const { t } = useT();
  return (
    <section className={`${sectionCls} bg-[#0B0C12] border-y border-white/5`} data-testid="inside-duplex-section">
      <Reveal>
        <SectionHead eyebrow={t("home.insideEyebrow")} titleA={t("home.insideA")} titleB={t("home.insideB")} testid="inside-duplex-title" />
        <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black" data-testid="inside-duplex-video-slot">
          <video
            src="/assets/duplex-showcase.mp4"
            poster="/assets/duplex-showcase.jpg"
            controls
            playsInline
            preload="none"
            className="w-full h-full object-contain"
            data-testid="inside-duplex-video"
          />
        </div>
      </Reveal>
    </section>
  );
}

export function BuyTicketsCta() {
  const { t, lp } = useT();
  return (
    <section className={`${sectionCls} bg-[#1F050D] text-center`} data-testid="buy-tickets-cta-section">
      <Reveal>
        <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#00F0FF] mb-4">27.09.2026 • DUPLEX Prague</p>
        <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight mb-8" data-testid="buy-tickets-cta-title">
          {t("home.ctaA")} <span className="text-[#FF0055]">{t("home.ctaB")}</span>
        </h2>
        <Link
          to={lp("/tickets")}
          data-testid="buy-tickets-cta-button"
          className="inline-flex items-center justify-center bg-[#FF6A00] hover:bg-[#FF7A1A] text-white font-display font-bold uppercase tracking-[0.15em] text-sm rounded-full px-10 py-4 transition-colors duration-300 shadow-[0_0_45px_rgba(255,106,0,0.35)]"
        >
          {t("home.buyTickets")}
        </Link>
      </Reveal>
    </section>
  );
}
