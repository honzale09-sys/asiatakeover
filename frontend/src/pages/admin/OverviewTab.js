import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatError, czk } from "@/api";
import { StatCard, cardCls } from "./shared";
import { GuestListCard } from "./GuestListCard";
import { CheckinReportCard } from "./CheckinReportCard";
import { FinalAuditCard } from "./FinalAuditCard";
import { TestModeCard } from "./TestModeCard";
import { SalesOverview } from "./SalesOverview";

function CategoryCard({ label, color, data, testid }) {
  return (
    <div className={cardCls} data-testid={testid}>
      <p className={`font-mono2 text-[11px] uppercase tracking-[0.25em] mb-2 ${color}`}>{label}</p>
      <p className="font-display font-black text-xl sm:text-2xl whitespace-nowrap">
        {data?.sold ?? 0} <span className="text-xs text-slate-500 font-bold">SOLD</span>
        <span className="text-slate-600 mx-1.5">/</span>
        <span className="text-green-400">{data?.checked_in ?? 0}</span> <span className="text-xs text-slate-500 font-bold">CHECKED IN</span>
      </p>
    </div>
  );
}

function RevenueCheckCard({ stats }) {
  const rc = stats.revenue_check;
  const rows = [
    ["Sold × tier price (list)", czk(rc.list_total_czk + rc.comp_nominal_czk), "rc-list", "font-mono2"],
    [`Comp tickets (${rc.comp_tickets} pcs, free)`, `−${czk(rc.comp_nominal_czk)}`, "rc-comps", "font-mono2 text-[#FFE600]"],
    ["Promo discounts", `−${czk(rc.promo_discount_czk)}`, "rc-promo", "font-mono2 text-[#FFE600]"],
  ];
  return (
    <div className={cardCls} data-testid="revenue-check-card">
      <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-6">Revenue check (Teya reconciliation)</p>
      <div className="space-y-3 text-sm max-w-md">
        {rows.map(([label, value, tid, cls]) => (
          <div key={tid} className="flex justify-between gap-4">
            <span className="text-slate-400">{label}</span>
            <span className={cls} data-testid={tid}>{value}</span>
          </div>
        ))}
        <div className="flex justify-between gap-4 pt-3 border-t border-white/10">
          <span className="text-white font-bold uppercase text-xs tracking-wider">= Actually paid (matches Teya)</span>
          <span className="font-mono2 font-bold text-green-400" data-testid="rc-paid">{czk(stats.revenue_czk)}</span>
        </div>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [tick, setTick] = useState(0);
  const load = useCallback(() => api.get("/admin/stats").then((r) => setStats(r.data)).catch((e) => toast.error(formatError(e))), []);
  useEffect(() => { load(); }, [load]);
  const reload = useCallback(() => { load(); setTick((t) => t + 1); }, [load]);
  if (!stats) return <p className="font-mono2 text-sm text-slate-500">Loading stats…</p>;
  return (
    <div className="space-y-8" data-testid="admin-overview">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={czk(stats.revenue_czk)} testid="stat-revenue" />
        <StatCard label="Tickets Sold" value={stats.tickets_sold} testid="stat-tickets-sold" />
        <StatCard label="Checked In" value={stats.checked_in} testid="stat-checked-in" />
        <StatCard label="Orders" value={stats.orders} testid="stat-orders" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2" data-testid="category-cards">
        <CategoryCard label="Standard" color="text-[#00F0FF]" data={stats.categories?.standard} testid="cat-standard" />
        <CategoryCard label="VIP" color="text-[#C9A227]" data={stats.categories?.vip} testid="cat-vip" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <GuestListCard category="vip" stats={stats} onSent={reload} />
        <GuestListCard category="standard" stats={stats} onSent={reload} />
      </div>
      <CheckinReportCard refreshKey={tick} />
      <FinalAuditCard />
      {stats.revenue_check && <RevenueCheckCard stats={stats} />}
      <SalesOverview />
      <TestModeCard />
    </div>
  );
}
