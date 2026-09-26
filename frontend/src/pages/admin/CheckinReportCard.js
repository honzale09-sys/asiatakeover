import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, RefreshCw } from "lucide-react";
import { api, formatError } from "@/api";
import { cardCls, actBtn, fmtDate } from "./shared";

function exportScansCsv(scans) {
  const rows = [["Ticket code", "Type", "Holder", "Email", "Checked in at", "Scanned by"]];
  scans.forEach((s) => rows.push([s.code, s.tier_name, s.holder_name || "", s.buyer_email || "", s.checked_in_at || "", s.checked_in_by || ""]));
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "asia-takeover-checkins.csv";
  a.click();
}

export function CheckinReportCard() {
  const [rep, setRep] = useState(null);
  const load = useCallback(
    () => api.get("/admin/checkin-report").then((r) => setRep(r.data)).catch((e) => toast.error(formatError(e))),
    []
  );
  useEffect(() => { load(); }, [load]);

  if (!rep) return <div className={cardCls}><p className="font-mono2 text-sm text-slate-500">Loading check-in report…</p></div>;

  const pct = rep.total_tickets ? Math.round((rep.checked_in / rep.total_tickets) * 100) : 0;
  const lastScan = rep.scans?.[0]?.checked_in_at;

  return (
    <div className={cardCls} data-testid="checkin-report-card">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400">Check-in report (scanned at the door)</p>
        <div className="flex gap-2">
          <button onClick={load} className={actBtn} data-testid="checkin-refresh"><RefreshCw size={12} className="inline mr-1" />Refresh</button>
          <button onClick={() => exportScansCsv(rep.scans || [])} className={actBtn} data-testid="checkin-export"><Download size={12} className="inline mr-1" />Export CSV</button>
        </div>
      </div>

      <p className="font-display font-black text-3xl sm:text-4xl text-green-400 mb-1" data-testid="checkin-total">
        {rep.checked_in} <span className="text-slate-600">/</span> <span className="text-white">{rep.total_tickets}</span>
        <span className="font-mono2 text-xs text-slate-500 ml-3">{pct}% CHECKED IN</span>
      </p>
      {lastScan && <p className="font-mono2 text-[11px] text-slate-500 mb-6">Last scan {fmtDate(lastScan)}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="checkin-report-table">
          <thead>
            <tr className="border-b border-white/10 font-mono2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
              <th className="text-left py-2 pr-4">Ticket type</th>
              <th className="text-right py-2 px-4">Tickets</th>
              <th className="text-right py-2 px-4">Checked in</th>
              <th className="text-right py-2 pl-4">Not scanned</th>
            </tr>
          </thead>
          <tbody>
            {rep.by_tier.map((r) => (
              <tr key={r.tier_name} className="border-b border-white/5" data-testid={`checkin-row-${r.tier_name}`}>
                <td className="py-2.5 pr-4 text-slate-200">{r.tier_name}</td>
                <td className="py-2.5 px-4 text-right font-mono2 text-xs text-slate-300">{r.sold}</td>
                <td className="py-2.5 px-4 text-right font-mono2 text-xs text-green-400">{r.checked_in}</td>
                <td className="py-2.5 pl-4 text-right font-mono2 text-xs text-slate-500">{r.sold - r.checked_in}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono2 text-[10px] text-slate-600 mt-4">Every QR is single-use — this counts individual tickets, not emails or orders.</p>
    </div>
  );
}
