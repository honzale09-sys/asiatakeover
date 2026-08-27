import { useState } from "react";
import { toast } from "sonner";
import { Instagram, Mail, MapPin } from "lucide-react";
import { api, formatError } from "@/api";
import { Reveal, SectionHead } from "./Reveal";

const inputCls =
  "w-full bg-[#0D0E15] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#FF0055] outline-none transition-colors";

export default function Contact({ event, content }) {
  const [form, setForm] = useState({ name: "", email: "", topic: "General", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/contact", form);
      toast.success("Message sent — we'll get back to you soon.");
      setForm({ name: "", email: "", topic: "General", message: "" });
    } catch (e2) {
      toast.error(formatError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="contact" className="px-4 sm:px-8 lg:px-16 py-20 lg:py-28" data-testid="contact-section">
      <Reveal>
        <SectionHead kicker="05 / The Link" title="Find Us At" accent="Duplex" />
      </Reveal>
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        <Reveal delay={0.1}>
          <div className="space-y-6">
            <div className="border border-white/10 rounded-3xl bg-[#0D0E15] p-8">
              <MapPin className="text-[#FF0055] mb-4" size={28} />
              <h3 className="font-display font-bold text-xl uppercase mb-2">{event?.venue || "DUPLEX"} {event?.city || "Prague"}</h3>
              <p className="text-slate-400 text-sm leading-relaxed" data-testid="contact-address">
                {event?.address || "Václavské náměstí 831/21, 110 00 Praha 1"}
              </p>
              <a
                href="https://maps.google.com/?q=DUPLEX+Prague"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-map-link"
                className="inline-block mt-4 font-mono2 text-xs uppercase tracking-[0.2em] text-[#00F0FF] hover:text-[#FFE600] transition-colors"
              >
                Open in Maps →
              </a>
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href={`mailto:${content?.contact_email || "info@asiatakeover.eu"}`}
                data-testid="contact-email-link"
                className="flex items-center gap-3 border border-white/10 rounded-full px-5 py-3 hover:border-[#FF0055] transition-colors"
              >
                <Mail size={16} className="text-[#FF0055]" />
                <span className="font-mono2 text-xs">{content?.contact_email || "info@asiatakeover.eu"}</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="contact-instagram-link"
                className="flex items-center gap-3 border border-white/10 rounded-full px-5 py-3 hover:border-[#00F0FF] transition-colors"
              >
                <Instagram size={16} className="text-[#00F0FF]" />
                <span className="font-mono2 text-xs">{content?.instagram || "@asiatakeover.prague"}</span>
              </a>
            </div>
          </div>
        </Reveal>
        <Reveal delay={0.2}>
          <form onSubmit={submit} className="border border-white/10 rounded-3xl bg-[#0D0E15] p-8 space-y-4" data-testid="contact-form">
            <h3 className="font-display font-bold text-lg uppercase mb-2">VIP tables & enquiries</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <input data-testid="contact-name-input" required className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input data-testid="contact-email-input" required type="email" className={inputCls} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <select data-testid="contact-topic-select" className={inputCls} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
              <option>General</option>
              <option>VIP Table Booking</option>
              <option>Press</option>
              <option>Sponsorship</option>
            </select>
            <textarea data-testid="contact-message-input" required rows={4} className={inputCls} placeholder="Your message…" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <button
              type="submit"
              disabled={busy}
              data-testid="contact-submit-button"
              className="w-full bg-[#FF0055] hover:bg-[#FFE600] hover:text-black text-white font-display font-bold uppercase text-sm py-3.5 rounded-full transition-colors duration-300 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send Message"}
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
