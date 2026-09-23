import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useT } from "@/i18n";

const ease = [0.16, 1, 0.3, 1];

export default function Hero({ event, tiers = [] }) {
  const { t, lp } = useT();
  const ga = [...tiers]
    .filter((t2) => !t2.name.toUpperCase().includes("VIP") && !t2.name.toUpperCase().includes("GROUP"))
    .sort((a, b) => a.price_czk - b.price_czk);
  const isAvailable = (t2) => (t2.sold || 0) < t2.capacity;
  const activeGA = ga.find(isAvailable);

  return (
    <section className="relative h-screen h-[100svh] overflow-hidden" data-testid="hero-section">
      <div className="absolute inset-0 z-0">
        <video
          ref={(v) => {
            if (v) {
              v.setAttribute("muted", "");
              v.setAttribute("webkit-playsinline", "");
              v.muted = true;
              v.defaultMuted = true;
              v.play().catch(() => {});
            }
          }}
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          disablePictureInPicture
          preload="auto"
          poster="/assets/hero-poster.jpg"
          className="w-full h-full object-cover"
        >
          <source src="/assets/hero-bg.webm" type="video/webm" />
          <source src="/assets/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-[#1F050D]/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060609]/60 via-transparent to-[#060609]/80" />
      </div>

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-5">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 1, ease }}
          className="flex items-center justify-center gap-5 sm:gap-8 mb-6 sm:mb-8"
          data-testid="hero-partner-logos"
        >
          <img src="/assets/logo-gangshii.png" alt="GANGSHII" className="h-4 sm:h-5 object-contain opacity-90" />
          <span className="w-px h-4 bg-white/20" />
          <img src="/assets/logo-duplex-clean.png" alt="DUPLEX The Rooftop Club" className="h-5 sm:h-6 object-contain opacity-90" />
          <span className="w-px h-4 bg-white/20" />
          <img
            src="/assets/logo-seoulvibes.jpg"
            alt="Seoul Vibes"
            className="h-6 sm:h-7 w-6 sm:w-7 rounded-full object-cover ring-1 ring-white/25"
          />
        </motion.div>

        <motion.img
          src="/assets/logo-atf.png"
          alt="ASIA TAKEOVER FESTIVAL"
          data-testid="hero-logo"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.1, ease }}
          className="w-[74vw] max-w-[560px] object-contain drop-shadow-[0_0_45px_rgba(255,20,80,0.3)]"
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.9, ease }}
          className="mt-6 sm:mt-8 flex flex-col items-center text-center"
        >
          <p className="font-mono2 text-xs sm:text-sm tracking-[0.3em] uppercase text-white/85" data-testid="hero-date">
            {event?.date_label || "27.09.2026"} • {(event?.venue || "DUPLEX").toUpperCase()} {(event?.city || "PRAGUE").toUpperCase()}
          </p>
          <p className="font-mono2 text-[10px] sm:text-xs tracking-[0.15em] sm:tracking-[0.25em] uppercase text-white/55 mt-3 whitespace-nowrap" data-testid="hero-benefit-line">
            {t("hero.benefit")}
          </p>

          {activeGA ? (
            <div className="mt-7 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <Link
                to={lp("/tickets")}
                data-testid="buy-tickets-button"
                className="inline-block whitespace-nowrap bg-[#FF6A00] hover:bg-[#FF8534] active:scale-95 text-white font-display font-bold uppercase text-xs sm:text-base tracking-[0.12em] sm:tracking-[0.15em] px-8 sm:px-12 py-4 rounded-full shadow-[0_0_24px_rgba(255,106,0,0.3)] transition-all duration-300 min-h-[54px]"
              >
                {t("hero.getTickets")}
              </Link>
              <Link
                to={lp("/upgrade")}
                data-testid="upgrade-to-vip-button"
                className="inline-block whitespace-nowrap border border-[#C9A227] text-[#E7C55A] hover:bg-[#C9A227]/10 active:scale-95 font-display font-bold uppercase text-xs sm:text-base tracking-[0.12em] sm:tracking-[0.15em] px-8 sm:px-10 py-4 rounded-full transition-all duration-300 min-h-[54px]"
              >
                {t("hero.upgrade")}
              </Link>
            </div>
          ) : (
            <p className="mt-7 font-display font-bold uppercase text-sm tracking-[0.2em] text-slate-500" data-testid="hero-soldout-all">
              {t("hero.soldOut")}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
