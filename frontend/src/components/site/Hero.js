import { motion } from "framer-motion";

const HERO_BG =
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHw0fHxuaWdodGNsdWIlMjBmZXN0aXZhbCUyMGNyb3dkfGVufDB8fHx8MTc4Nzg0NDk2OXww&ixlib=rb-4.1.0&q=85";

const ease = [0.16, 1, 0.3, 1];

export default function Hero({ event }) {
  return (
    <section
      className="relative h-screen flex flex-col items-center justify-center overflow-hidden"
      data-testid="hero-section"
    >
      <div className="absolute inset-0 -z-10">
        <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060609]/60 via-transparent to-[#060609]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 1, ease }}
        className="flex items-center gap-6 sm:gap-10 mb-10 sm:mb-14"
        data-testid="hero-partner-logos"
      >
        <img src="/assets/logo-gangshii.png" alt="GANGSHII" className="h-5 sm:h-7 object-contain" />
        <span className="w-px h-6 bg-white/25" />
        <img src="/assets/logo-duplex-clean.png" alt="DUPLEX The Rooftop Club" className="h-6 sm:h-8 object-contain" />
        <span className="w-px h-6 bg-white/25" />
        <img
          src="/assets/logo-seoulvibes.jpg"
          alt="Seoul Vibes"
          className="h-8 sm:h-10 w-8 sm:w-10 rounded-full object-cover ring-1 ring-white/30"
        />
      </motion.div>

      <motion.img
        src="/assets/logo-atf.png"
        alt="ASIA TAKEOVER FESTIVAL"
        data-testid="hero-logo"
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 1.2, ease }}
        className="w-[80vw] max-w-[620px] object-contain"
      />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1 }}
        className="mt-10 sm:mt-14 flex flex-col items-center gap-5"
      >
        <p className="font-mono2 text-xs sm:text-sm tracking-[0.35em] uppercase text-white/70" data-testid="hero-date">
          {event?.date_label || "27.09.2026"} — {event?.venue || "DUPLEX"} {event?.city || "Prague"}
        </p>
        <button
          data-testid="hero-buy-tickets-button"
          onClick={() => document.getElementById("tickets")?.scrollIntoView({ behavior: "smooth" })}
          className="font-mono2 text-[11px] sm:text-xs uppercase tracking-[0.3em] border border-white/30 hover:bg-white hover:text-black rounded-full px-8 py-3 transition-colors duration-300"
        >
          Get Tickets
        </button>
      </motion.div>

      <motion.button
        data-testid="scroll-down-indicator"
        onClick={() => document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" })}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="absolute bottom-8 flex flex-col items-center gap-3 text-white/60 hover:text-white transition-colors"
      >
        <span className="font-mono2 text-[10px] tracking-[0.4em] uppercase">Scroll</span>
        <div className="w-px h-12 bg-white/20 relative overflow-hidden">
          <motion.span
            className="absolute top-0 left-0 w-full h-4 bg-white"
            animate={{ y: [-16, 48] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.button>
    </section>
  );
}
