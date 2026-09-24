import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { api, formatError, czk } from "@/api";
import { cardCls } from "./shared";

const RANGES = [["today", "Today", 1], ["3d", "Last 3 days", 3], ["7d", "Last 7 days", 7], ["14d", "Last 14 days", 14], ["all", "All time", null]];
const CATS = [["all", "All"], ["standard", "Standard"], ["vip", "VIP"]];
const METRICS = [["tickets", "Tickets Sold"], ["revenue", "Revenue"]];
const COLOR = { standard: "#00F0FF", vip: "#C9A227" };

const shiftDay = (isoDay, back) => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};
const dayLabel = (isoDay) => `${isoDay.slice(8, 10)}.${isoDay.slice(5, 7)}.`;

function Pills({ label, options, value, onChange, testid }) {
  return (
    <div className="min-w-0">
      <p className="font-mono2 text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-2">{label}</p>
      <div className="flex gap-2 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar -mx-1 px-1 pb-1" data-testid={testid}>
        {options.map(([id, text]) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            data-testid={`${testid}-${id}`}
            className={`shrink-0 font-mono2 text-[10px] sm:text-[11px] uppercase tracking-[0.12em] px-3 py-2 rounded-full border transition-colors duration-300 ${
              value === id
                ? "bg-[#FF0055] border-[#FF0055] text-white"
                : "border-white/15 text-slate-400 hover:border-[#00F0FF] hover:text-[#00F0FF]"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, color, testid }) {
  return (
    <div className="border border-white/10 rounded-xl bg-[#101119] px-4 py-3" data-testid={testid}>
      <p className="font-mono2 text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1.5">{label}</p>
      <p className={`font-display font-black text-lg sm:text-2xl whitespace-nowrap ${color}`}>{value}</p>
    </div>
  );
}

export function SalesOverview() {
  const [data, setData] = useState(null);
  const [range, setRange] = useState("7d");
  const [cat, setCat] = useState("all");
  const [metric, setMetric] = useState("tickets");

  useEffect(() => {
    api.get("/admin/sales-overview").then((r) => setData(r.data)).catch((e) => toast.error(formatError(e)));
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const days = RANGES.find(([id]) => id === range)[2];
    const from = days ? shiftDay(data.today, days - 1) : null;
    const rows = data.rows.filter((r) => (!from || r.date >= from) && (cat === "all" || r.category === cat));
    const sum = (fn) => rows.reduce((s, r) => s + fn(r), 0);
    const dayKeys = days
      ? Array.from({ length: days }, (_, i) => shiftDay(data.today, days - 1 - i))
      : [...new Set(data.rows.map((r) => r.date))].sort();
    const buckets = new Map(dayKeys.map((d) => [d, { day: dayLabel(d), standard: 0, vip: 0 }]));
    rows.forEach((r) => {
      const b = buckets.get(r.date);
      if (b) b[r.category] += metric === "revenue" ? r.revenue : r.tickets;
    });
    return {
      chart: [...buckets.values()],
      total: sum((r) => r.tickets),
      standard: sum((r) => (r.category === "standard" ? r.tickets : 0)),
      vip: sum((r) => (r.category === "vip" ? r.tickets : 0)),
      revenue: sum((r) => r.revenue),
      empty: rows.length === 0,
    };
  }, [data, range, cat, metric]);

  if (!view) return <div className={cardCls}><p className="font-mono2 text-sm text-slate-500">Loading sales…</p></div>;

  const fmt = (v) => (metric === "revenue" ? czk(v) : v);
  const bars = cat === "all" ? ["standard", "vip"] : [cat];

  return (
    <div className={cardCls} data-testid="sales-overview">
      <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-6">Sales overview</p>

      <div className="grid gap-5 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-5 mb-7">
        <Pills label="Time" options={RANGES.map(([id, t]) => [id, t])} value={range} onChange={setRange} testid="so-time" />
        <Pills label="Ticket" options={CATS} value={cat} onChange={setCat} testid="so-ticket" />
        <Pills label="Metric" options={METRICS} value={metric} onChange={setMetric} testid="so-metric" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        <SummaryCell label="Total sold" value={view.total} color="text-white" testid="so-total-sold" />
        <SummaryCell label="Standard sold" value={view.standard} color="text-[#00F0FF]" testid="so-standard-sold" />
        <SummaryCell label="VIP sold" value={view.vip} color="text-[#C9A227]" testid="so-vip-sold" />
        <SummaryCell label="Revenue" value={czk(view.revenue)} color="text-[#FFE600]" testid="so-revenue" />
      </div>

      {view.empty ? (
        <p className="font-mono2 text-xs text-slate-500 py-10 text-center" data-testid="so-empty">No paid sales in this period</p>
      ) : (
        <div className="h-64 sm:h-72" data-testid="so-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={view.chart} barGap={2}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} width={metric === "revenue" ? 62 : 34} tickFormatter={(v) => (metric === "revenue" ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip
                formatter={(v, name) => [fmt(v), name]}
                contentStyle={{ background: "#0D0E15", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}
                labelStyle={{ color: "#00F0FF" }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              {cat === "all" && <Legend wrapperStyle={{ fontSize: 11, color: "#94A3B8" }} />}
              {bars.map((key) => (
                <Bar key={key} dataKey={key} name={key === "vip" ? "VIP" : "Standard"} fill={COLOR[key]} radius={[5, 5, 0, 0]} maxBarSize={46} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="font-mono2 text-[10px] text-slate-600 mt-4">Successfully paid orders only — free comps and VIP Guest List excluded</p>
    </div>
  );
}
