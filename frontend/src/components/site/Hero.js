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

    </section>
  );
}
