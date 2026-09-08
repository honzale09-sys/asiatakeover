import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/site/Navbar";
import Footer from "@/components/site/Footer";
import { Reveal } from "@/components/site/Reveal";
import { api, formatError } from "@/api";
import { toast } from "sonner";

const inputCls =
  "w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#C9A227] transition-colors";

export default function ReservePage() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", guests: 4, floor: "Seoul Floor (7th)", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/reservations", { ...form, guests: Number(form.guests) });
      setSent(true);
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative bg-[#060609] text-white min-h-screen" data-testid="reserve-page">
      <div className="noise-bg fixed inset-0 z-[60] pointer-events-none opacity-[0.05]" />
      <Navbar />
      <main className="pt-24 sm:pt-28 px-4 sm:px-8 pb-16">
        <Reveal>
          <div className="max-w-md mx-auto">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.3em] text-[#C9A227] mb-3">VIP Table Ticket</p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mb-2" data-testid="reserve-title">
              Reserve a <span className="text-[#C9A227]">Table</span>
            </h1>
            <p className="text-slate-400 text-sm mb-8">
              Tell us what you need — we will get back to you with table options and bottle service details.
            </p>

            {sent ? (
              <div className="border border-[#C9A227]/40 bg-[#0D0E15] rounded-2xl p-8 text-center" data-testid="reserve-success">
                <p className="text-4xl mb-4">🏆</p>
                <h2 className="font-display font-extrabold text-lg uppercase mb-2">Request received</h2>
                <p className="text-slate-400 text-sm leading-relaxed">
                  We will contact you shortly to arrange your VIP table. See you on 27.09. at DUPLEX.
                </p>
                <Link to="/tickets" data-testid="reserve-back-link" className="inline-block mt-6 font-mono2 text-xs uppercase tracking-[0.2em] text-[#00F0FF] hover:underline">
                  ← Back to tickets
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" data-testid="reserve-form">
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Full name</label>
                  <input data-testid="reserve-name-input" required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                </div>
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Phone number</label>
                  <input data-testid="reserve-phone-input" required type="tel" className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+420 …" />
                </div>
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Email</label>
                  <input data-testid="reserve-email-input" required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Guests</label>
                    <input data-testid="reserve-guests-input" required type="number" min="1" max="30" className={inputCls} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} />
                  </div>
                  <div>
                    <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Preferred floor</label>
                    <select data-testid="reserve-floor-select" className={inputCls} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })}>
                      <option>Seoul Floor (7th)</option>
                      <option>Mainstream Floor (6th)</option>
                      <option>Saigon Floor (5th)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-mono2 text-[11px] uppercase tracking-[0.2em] text-slate-400 block mb-1.5">Message (optional)</label>
                  <textarea data-testid="reserve-message-input" rows={4} className={inputCls} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Occasion, budget, bottle preferences…" />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  data-testid="reserve-submit-button"
                  className="w-full bg-[#C9A227] hover:bg-[#dbb53a] text-black font-display font-bold uppercase text-sm py-4 rounded-full transition-colors duration-300 disabled:opacity-50 min-h-[52px]"
                >
                  {sending ? "Sending…" : "Send Request"}
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
