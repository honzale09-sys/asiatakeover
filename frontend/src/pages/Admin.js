import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { api } from "@/api";
import AdminLogin from "@/components/AdminLogin";
import { OverviewTab } from "./admin/OverviewTab";
import { OrdersTab } from "./admin/OrdersTab";
import { EventsTab } from "./admin/EventsTab";
import { TiersTab } from "./admin/TiersTab";
import { ContentTab } from "./admin/ContentTab";
import { MessagesTab } from "./admin/MessagesTab";
import { AmbassadorsTab } from "./admin/AmbassadorsTab";
import { DiscountCodesTab } from "./admin/DiscountCodesTab";

const TABS = [
  ["overview", "Overview", OverviewTab],
  ["orders", "Orders & Tickets", OrdersTab],
  ["events", "Parties", EventsTab],
  ["tiers", "Ticket Tiers", TiersTab],
  ["content", "Site Content", ContentTab],
  ["messages", "Messages", MessagesTab],
  ["ambassadors", "Ambassadors", AmbassadorsTab],
  ["discounts", "Discount Codes", DiscountCodesTab],
];

export default function Admin() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false));
  }, []);

  if (user === null)
    return <div className="min-h-screen bg-[#060609] flex items-center justify-center font-mono2 text-xs text-slate-500 uppercase tracking-[0.3em]">Loading…</div>;
  if (user === false)
    return <AdminLogin title="Command Deck" subtitle="Sign in to manage ASIA TAKEOVER FESTIVAL" onLogin={setUser} testPrefix="admin" />;

  const logout = async () => {
    await api.post("/auth/logout").catch((e) => console.warn("Admin: logout request failed", e));
    setUser(false);
  };
  const ActiveTab = TABS.find(([id]) => id === tab)[2];

  return (
    <div className="min-h-screen bg-[#060609] text-white" data-testid="admin-dashboard">
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="px-4 sm:px-8 h-16 flex items-center justify-between">
          <p className="font-display font-black uppercase text-sm sm:text-base">
            ATF <span className="text-[#FF0055]">✦</span> Command Deck
          </p>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block font-mono2 text-xs text-slate-500">{user.email}</span>
            <button onClick={logout} data-testid="admin-logout-button" className="flex items-center gap-2 font-mono2 text-xs uppercase tracking-wider text-slate-400 hover:text-[#FF0055] transition-colors">
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>
      </header>
      <div className="px-4 sm:px-8 py-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              data-testid={`admin-tab-${id}`}
              onClick={() => setTab(id)}
              className={`font-mono2 text-xs uppercase tracking-[0.15em] px-4 py-2.5 rounded-full border transition-colors duration-300 ${
                tab === id ? "bg-[#FF0055] border-[#FF0055] text-white" : "border-white/15 text-slate-400 hover:border-[#00F0FF] hover:text-[#00F0FF]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <ActiveTab />
      </div>
    </div>
  );
}
