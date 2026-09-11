import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { useT } from "@/i18n";

export default function GalleryPage() {
  const { t } = useT();
  return (
    <div className="relative bg-[#060609] text-white min-h-screen" data-testid="gallery-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <Navbar />
      <main className="pt-24 sm:pt-28">
        <section className="px-4 sm:px-8 lg:px-16 py-12 lg:py-16" data-testid="map-section">
          <Reveal>
            <p className="font-mono2 text-xs uppercase tracking-[0.3em] text-[#00F0FF] mb-4">{t("gallery.eyebrow")}</p>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight mb-4">
              {t("gallery.titleA")} <span className="text-[#FF0055]">{t("gallery.titleB")}</span>
            </h2>
            <p className="font-mono2 text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-8">
              {t("gallery.rooms")}
            </p>
            <img
              src="/assets/floorplan.jpg"
              alt="DUPLEX floor map — KPOP Room, Mainstream Room, Saigon Room"
              loading="lazy"
              className="w-full rounded-2xl border border-white/10"
              data-testid="map-image"
            />
          </Reveal>
        </section>
      </main>
      <Footer />
    </div>
  );
}
