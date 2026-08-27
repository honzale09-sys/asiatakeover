import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin } from "lucide-react";
import { Reveal, SectionHead } from "./Reveal";

const slug = (s) => s.replace(/[^a-z0-9]/gi, "-").toLowerCase();

export default function Lineup({ lineup = [], genres = [] }) {
  const [filter, setFilter] = useState("ALL");
  const filters = ["ALL", ...genres];
  const shown = filter === "ALL" ? lineup : lineup.filter((d) => d.genre === filter);

  return (
    <section id="lineup" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28" data-testid="lineup-section">
      <Reveal>
        <SectionHead kicker="01 / The Sound" title="10 International DJs" accent="3 Floors" />
      </Reveal>
      <Reveal delay={0.1}>
        <div className="flex flex-wrap gap-2 mb-10" data-testid="lineup-filters">
          {filters.map((g) => (
            <button
              key={g}
              data-testid={`lineup-filter-${slug(g)}`}
              onClick={() => setFilter(g)}
              className={`font-mono2 text-xs uppercase tracking-[0.15em] px-4 py-2 rounded-full border transition-colors duration-300 ${
                filter === g
                  ? "bg-[#FF0055] border-[#FF0055] text-white neon-shadow"
                  : "border-white/15 text-slate-400 hover:border-[#00F0FF] hover:text-[#00F0FF]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 gap-4" data-testid="lineup-grid">
        {shown.map((dj, i) => (
          <motion.div
            layout
            key={dj.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.6, delay: (i % 4) * 0.08 }}
            data-testid={`lineup-card-${i}`}
            className="group relative border border-white/10 hover:border-[#FF0055]/60 bg-[#0D0E15] hover:bg-[#141622] rounded-2xl p-6 transition-colors duration-300 overflow-hidden"
          >
            <span className="absolute -top-3 right-4 font-display font-black text-6xl text-white/5 group-hover:text-[#FF0055]/15 transition-colors duration-300">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-[#00F0FF] mb-2">{dj.genre}</p>
            <h3 className="font-display font-bold text-xl sm:text-2xl uppercase tracking-tight mb-4 group-hover:text-[#FFE600] transition-colors duration-300">
              {dj.name}
            </h3>
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <MapPin size={12} className="text-[#FF0055]" /> {dj.stage}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="text-[#FFE600]" /> {dj.time}
              </span>
              {dj.origin && <span className="text-slate-500">{dj.origin}</span>}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
