import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Calendar, MapPin } from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHw0fHxuaWdodGNsdWIlMjBmZXN0aXZhbCUyMGNyb3dkfGVufDB8fHx8MTc4Nzg0NDk2OXww&ixlib=rb-4.1.0&q=85";

function useCountdown(target) {
  const [t, setT] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    if (!target) return;
    const tick = () => {
      const diff = Math.max(0, new Date(target).getTime() - Date.now());
      setT({
        d: Math.floor(diff / 864e5),
        h: Math.floor(diff / 36e5) % 24,
        m: Math.floor(diff / 6e4) % 60,
        s: Math.floor(diff / 1e3) % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return t;
}

const LINES = ["ASIA", "TAKEOVER", "FESTIVAL"];
const UNITS = [
  ["DAYS", "d"],
  ["HRS", "h"],
  ["MIN", "m"],
  ["SEC", "s"],
];

export default function Hero({ event, content, sold, capacity }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], [0, 240]);
  const t = useCountdown(event?.date);
  const pct = Math.min(100, Math.round(((sold || 0) / (capacity || 1500)) * 100));

  return (
    <section className="relative min-h-screen flex flex-col justify-end overflow-hidden" data-testid="hero-section">
      <motion.div style={{ y }} className="absolute inset-0 -z-10">
        <img src={HERO_IMG} alt="Festival crowd" className="w-full h-[120%] object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060609]/70 via-[#060609]/40 to-[#060609]" />
        <div className="absolute inset-0 scanlines" />
      </motion.div>

      <div className="px-4 sm:px-8 lg:px-16 pt-32 pb-10 w-full">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="font-mono2 text-xs sm:text-sm uppercase tracking-[0.35em] text-[#00F0FF] mb-6"
          data-testid="hero-presented-by"
        >
          {event?.presented_by || "DUPLEX × SEOULVIBES × GANGSHII"} present
        </motion.p>

        <h1 className="font-display font-black uppercase leading-[0.92] tracking-tighter text-[15vw] sm:text-[11vw] lg:text-[8.5rem]" data-testid="hero-title">
          {LINES.map((line, i) => (
            <span key={line} className="block overflow-hidden">
              <motion.span
                className={`block ${i === 1 ? "text-stroke-neon neon-flicker" : ""}`}
                initial={{ y: "115%" }}
                animate={{ y: 0 }}
                transition={{ delay: 0.25 + i * 0.18, duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-16"
        >
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-4 font-mono2 text-sm mb-4">
              <span className="flex items-center gap-2 text-[#FFE600]" data-testid="hero-date">
                <Calendar size={16} /> {event?.date_label || "27.09.2026"}
              </span>
              <span className="flex items-center gap-2 text-slate-300" data-testid="hero-venue">
                <MapPin size={16} className="text-[#FF0055]" /> {event?.venue || "DUPLEX"} · {event?.city || "Prague"}
              </span>
            </div>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed" data-testid="hero-sub">
              {content?.hero_sub ||
                "The biggest Asian festival in Prague. 3 floors. 10 international DJs. 2 rooftops. One night only."}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                data-testid="hero-buy-tickets-button"
                onClick={() => document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-[#FF0055] hover:bg-[#FFE600] hover:text-black text-white font-display font-bold uppercase text-sm px-8 py-4 rounded-full transition-colors duration-300 neon-shadow"
              >
                Get Tickets
              </button>
              <button
                data-testid="hero-lineup-button"
                onClick={() => document.getElementById("lineup")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-white/25 hover:border-[#00F0FF] hover:text-[#00F0FF] text-white font-display font-bold uppercase text-sm px-8 py-4 rounded-full transition-colors duration-300"
              >
                Lineup
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5" data-testid="hero-countdown">
            <div className="grid grid-cols-4 gap-2">
              {UNITS.map(([label, k]) => (
                <div key={k} className="glass border border-white/10 rounded-xl px-3 py-3 text-center min-w-[72px]">
                  <div className="font-display font-extrabold text-2xl text-[#FFE600]">
                    {String(t[k]).padStart(2, "0")}
                  </div>
                  <div className="font-mono2 text-[10px] tracking-[0.25em] text-slate-400 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div data-testid="hero-ticket-progress">
              <div className="flex justify-between font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 mb-2">
                <span>{sold || 0} claimed</span>
                <span>{capacity || 1500} capacity</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#FF0055] to-[#00F0FF]"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 1.4, duration: 1.2, ease: "easeOut" }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative h-14 flex items-end gap-[3px] px-4 sm:px-8 lg:px-16 opacity-50" aria-hidden>
        {Array.from({ length: 48 }).map((_, i) => (
          <div
            key={i}
            className={`eq-bar flex-1 rounded-t ${i % 3 === 0 ? "bg-[#FF0055]" : i % 3 === 1 ? "bg-[#00F0FF]" : "bg-[#FFE600]"}`}
            style={{ height: "100%", animationDelay: `${(i % 12) * 0.09}s`, animationDuration: `${0.8 + (i % 5) * 0.12}s` }}
          />
        ))}
      </div>
    </section>
  );
}
