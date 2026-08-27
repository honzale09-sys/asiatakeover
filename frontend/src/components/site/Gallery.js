import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const CHAPTERS = [
  {
    id: "map",
    img: "/assets/floorplan.png",
    label: "",
    sub: "",
    contain: true,
  },
];

function Chapter({ chapter }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0.02, 0.42], [0.55, 1]);
  const radius = useTransform(scrollYProgress, [0.02, 0.42], [40, 0]);
  const opacity = useTransform(scrollYProgress, [0.02, 0.25], [0.25, 1]);
  const textY = useTransform(scrollYProgress, [0.28, 0.45], [70, 0]);
  const textOpacity = useTransform(scrollYProgress, [0.28, 0.45], [0, 1]);

  return (
    <div ref={ref} className="relative h-[220vh]" data-testid={`gallery-chapter-${chapter.id}`}>
      <div className={`sticky top-0 h-screen flex items-center justify-center overflow-hidden ${chapter.contain ? "bg-[#1c0308]" : ""}`}>
        <motion.div style={{ scale, borderRadius: radius, opacity }} className="w-full h-full overflow-hidden">
          <img
            src={chapter.img}
            alt={chapter.label}
            className={`w-full h-full ${chapter.contain ? "object-contain" : "object-cover"}`}
          />
        </motion.div>
        {chapter.label && (
          <motion.div
            style={{ y: textY, opacity: textOpacity }}
            className="absolute bottom-12 left-0 right-0 text-center pointer-events-none"
          >
            <p className="font-display font-black uppercase tracking-tight text-3xl sm:text-5xl [text-shadow:0_2px_24px_rgba(0,0,0,0.8)]">
              {chapter.label}
            </p>
            {chapter.sub && (
              <p className="font-mono2 text-[11px] sm:text-xs uppercase tracking-[0.3em] text-white/70 mt-3">
                {chapter.sub}
              </p>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function Gallery() {
  return (
    <section id="gallery" data-testid="gallery-section">
      {CHAPTERS.map((c) => (
        <Chapter key={c.id} chapter={c} />
      ))}
    </section>
  );
}
