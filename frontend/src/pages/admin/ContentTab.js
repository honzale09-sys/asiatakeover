import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError } from "@/api";
import { cardCls, inputCls, labelCls } from "./shared";

const EMPTY = { announcement: "", hero_sub: "", contact_email: "", instagram: "" };

export function ContentTab() {
  const [form, setForm] = useState(EMPTY);
  const [lockdown, setLockdown] = useState(true);
  useEffect(() => {
    api.get("/site").then((r) => {
      const c = r.data.content || {};
      setForm({ announcement: c.announcement || "", hero_sub: c.hero_sub || "", contact_email: c.contact_email || "", instagram: c.instagram || "" });
    }).catch((e) => console.warn("Admin content: site load failed", e));
    api.get("/gate/status").then((r) => setLockdown(r.data.enabled)).catch((e) => console.warn("Admin content: gate status failed", e));
  }, []);

  const upd = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put("/admin/content", form);
      await api.put("/admin/lockdown", { enabled: lockdown });
      toast.success(lockdown ? "Saved — site stays locked" : "Saved — SITE IS NOW PUBLIC");
    } catch (e2) {
      toast.error(formatError(e2));
    }
  };

  return (
    <form onSubmit={save} className={`${cardCls} max-w-2xl space-y-5`} data-testid="content-form">
      <p className="font-display font-bold uppercase">Edit site content</p>
      <label className="flex items-center justify-between gap-4 border border-white/10 rounded-xl px-4 py-3.5" data-testid="lockdown-toggle-row">
        <div>
          <p className="font-mono2 text-xs uppercase tracking-[0.2em] text-white">Site lockdown</p>
          <p className="font-mono2 text-[11px] text-slate-500 mt-1">{lockdown ? "Visitors see the password page" : "Site is open to the public"}</p>
        </div>
        <button
          type="button"
          onClick={() => setLockdown(!lockdown)}
          data-testid="lockdown-toggle"
          className={`relative w-14 h-8 rounded-full transition-colors duration-300 shrink-0 ${lockdown ? "bg-[#FF0055]" : "bg-emerald-500"}`}
        >
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 ${lockdown ? "left-1" : "left-7"}`} />
        </button>
      </label>
      <div>
        <label className={labelCls}>Announcement (marquee ribbon)</label>
        <input className={inputCls} value={form.announcement} onChange={upd("announcement")} data-testid="content-announcement-input" />
      </div>
      <div>
        <label className={labelCls}>Hero subtitle</label>
        <textarea rows={3} className={inputCls} value={form.hero_sub} onChange={upd("hero_sub")} data-testid="content-hero-sub-input" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Contact email</label>
          <input className={inputCls} value={form.contact_email} onChange={upd("contact_email")} data-testid="content-email-input" />
        </div>
        <div>
          <label className={labelCls}>Instagram</label>
          <input className={inputCls} value={form.instagram} onChange={upd("instagram")} data-testid="content-instagram-input" />
        </div>
      </div>
      <button type="submit" data-testid="content-save-button" className="bg-[#FF0055] hover:bg-[#FFE600] hover:text-black font-display font-bold uppercase text-sm px-8 py-3.5 rounded-full transition-colors duration-300">
        Save Content
      </button>
    </form>
  );
}
