import { useRef, useState } from "react";
import { useT } from "@/i18n";

const POSTERS = [
  { src: "/assets/poster-festival.jpg", alt: "ASIA TAKEOVER FESTIVAL — official poster" },
  { src: "/assets/poster-floors.jpg", alt: "Floor map — KPOP Room, Mainstream Room, Saigon Room" },
  { src: "/assets/poster-lineup.jpg", alt: "Full line up — all 3 stages" },
];

export function PosterCarousel() {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const { t } = useT();
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const go = (i) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  return (
    <div className="lg:sticky lg:top-8">
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl border border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-w-sm mx-auto cursor-grab active:cursor-grabbing"
        data-testid="poster-carousel"
      >
        {POSTERS.map((p, i) => (
          <img
            key={p.src}
            src={p.src}
            alt={p.alt}
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            className="w-full shrink-0 snap-center aspect-[4/5] object-cover select-none"
            data-testid={`poster-slide-${i + 1}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2.5 mt-4" data-testid="poster-dots">
        {POSTERS.map((p, i) => (
          <button
            key={p.src}
            onClick={() => go(i)}
            aria-label={`Poster ${i + 1}`}
            data-testid={`poster-dot-${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? "w-7 bg-[#FF0055]" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
          />
        ))}
      </div>
      <p className="font-mono2 text-[10px] uppercase tracking-[0.3em] text-white/35 text-center mt-3 animate-pulse sm:hidden" data-testid="poster-swipe-hint">
        {t("tickets.swipe")} →
      </p>
    </div>
  );
}
