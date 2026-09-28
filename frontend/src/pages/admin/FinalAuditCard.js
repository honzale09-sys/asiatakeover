import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { api, formatError, czk } from "@/api";
import { cardCls } from "./shared";

function Row({ label, value, accent, testid }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-white/5">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`font-mono2 text-sm font-bold ${accent || "text-white"}`} data-testid={testid}>{value}</span>
    </div>
  );
}

function CategoryBlock({ title, color, b, testidPrefix }) {
  return (
    <div>
      <p className={`font-mono2 text-xs uppercase tracking-[0.25em] mb-2 ${color}`}>{title}</p>
      <Row label="Paid tickets issued" value={b.paid_issued} testid={`${testidPrefix}-paid`} />
      <Row label="Guest list / free issued" value={b.free_issued} testid={`${testidPrefix}-free`} />
      <Row label="Checked in" value={b.checked_in} accent="text-green-400" testid={`${testidPrefix}-in`} />
      <Row label="NOT checked in" value={b.not_checked_in} accent="text-[#FFE600]" testid={`${testidPrefix}-out`} />
    </div>
  );
}

export function FinalAuditCard() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post("/admin/final-audit");
      setData(r.data);
      if (r.data.repaired_checkins) toast.success(`Repaired ${r.data.repaired_checkins} scanned-but-unmarked ticket(s)`);
      else toast.success("Audit complete — no repairs needed");
    } catch (e) {
      toast.error(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cardCls} data-testid="final-audit-card">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400">Final wristband audit (real data only)</p>
        <button
          onClick={run}
          disabled={busy}
          data-testid="run-final-audit"
          className="flex items-center gap-2 font-mono2 text-xs uppercase tracking-[0.15em] px-5 py-2.5 rounded-lg border border-[#00F0FF] text-[#00F0FF] hover:bg-[#00F0FF] hover:text-black transition-colors disabled:opacity-40"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
          {busy ? "Running…" : data ? "Re-run audit" : "Run final audit"}
        </button>
      </div>

      {!data && <p className="font-mono2 text-[11px] text-slate-500">Counts each ticket once, excludes test tickets, fixes any scanned-but-unmarked check-ins, and compares against wristbands supplied.</p>}

      {data && (
        <div className="space-y-6" data-testid="final-audit-results">
          <div className="grid gap-6 sm:grid-cols-2">
            <CategoryBlock title="Standard" color="text-[#00F0FF]" b={data.standard} testidPrefix="audit-std" />
            <CategoryBlock title="VIP" color="text-[#C9A227]" b={data.vip} testidPrefix="audit-vip" />
          </div>

          <div className="pt-2">
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-2">Total</p>
            <Row label="Paid tickets issued" value={data.total.paid_issued} testid="audit-total-paid" />
            <Row label="Guest list / free issued" value={data.total.free_issued} testid="audit-total-free" />
            <Row label="Total tickets issued" value={data.total.total_issued} testid="audit-total-issued" />
            <Row label="Unique checked-in guests" value={data.total.checked_in} accent="text-green-400" testid="audit-total-in" />
            <Row label="Total NOT checked in" value={data.total.not_checked_in} accent="text-[#FFE600]" testid="audit-total-out" />
            <Row label="Actual ticket revenue" value={czk(data.total.revenue_czk)} accent="text-green-400" testid="audit-total-revenue" />
          </div>

          <div className="pt-2">
            <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-slate-400 mb-2">Wristbands remaining</p>
            <Row label="Standard (1,500 supplied)" value={`${data.wristbands.standard_remaining} left · ${data.wristbands.standard_checked_in} used`} accent="text-[#00F0FF]" testid="audit-wb-standard" />
            <Row label="VIP (500 supplied)" value={`${data.wristbands.vip_remaining} left · ${data.wristbands.vip_checked_in} used`} accent="text-[#C9A227]" testid="audit-wb-vip" />
          </div>

          {data.repaired_checkins > 0 && (
            <p className="font-mono2 text-[11px] text-green-400" data-testid="audit-repaired">
              Fixed {data.repaired_checkins} ticket(s) that had a scan entry but weren't marked checked-in.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
