import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const ease = [0.16, 1, 0.3, 1];

export default function Hero({ event }) {
  return (
    <section
      className="relative h-screen overflow-hidden"
      data-testid="hero-section"
    >
      <div className="absolute inset-0 z-0">
        <video autoPlay muted loop playsInline preload="auto" className="w-full h-full object-cover">
          <source src="/assets/hero-bg.webm" type="video/webm" />
          <source src="/assets/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060609]/70 via-transparent to-[#060609]" />
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-5">
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.9, ease }}
      >
        <Link
          to="/tickets"
          data-testid="buy-tickets-button"
          className="inline-block mt-10 sm:mt-12 bg-[#FF6A00] text-white font-display font-bold uppercase text-sm sm:text-base tracking-[0.2em] px-12 py-4 rounded-full shadow-[0_0_45px_rgba(255,106,0,0.45)] hover:bg-[#FF8534] hover:shadow-[0_0_60px_rgba(255,106,0,0.65)] hover:scale-105 active:scale-95 transition-all duration-300"
        >
          Buy Tickets
        </Link>
      </motion.div>
      </div>

    </section>
  );
}
