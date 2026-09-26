import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Trash2 } from "lucide-react";
import { api, API, formatError } from "@/api";
import { cardCls, actBtn, fmtDate } from "./shared";

function TestRow({ t }) {
  const used = t.status === "used";
  return (
    <div className="flex items-center gap-4 border border-white/10 rounded-xl p-3" data-testid={`test-ticket-${t.code}`}>
      <img src={`${API}/qr/${t.code}.png`} alt={`QR ${t.code}`} className="w-20 h-20 rounded-lg bg-white p-1 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold text-sm text-white truncate">{t.tier_name}</p>
        <p className="font-mono2 text-xs text-slate-400 mt-0.5">{t.code}</p>
        <p className="font-mono2 text-[10px] text-slate-500 mt-0.5">
          {t.wristband === "vip" ? "VIP wristband" : "Standard wristband"} · {t.gift ? "surprise gift YES" : "surprise gift NO"}
        </p>
      </div>
      <span
        data-testid={`test-status-${t.code}`}
        className={`font-mono2 text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border shrink-0 ${
          used ? "text-[#FF0055] border-[#FF0055]/40" : "text-green-400 border-green-400/30"
        }`}
      >
        {used ? "Used" : "Valid"}
      </span>
    </div>
  );
}

export function TestModeCard() {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () => api.get("/admin/test-tickets").then((r) => setList(r.data)).catch((e) => toast.error(formatError(e))),
    []
  );
  useEffect(() => { load(); }, [load]);

  const run = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      toast.success(done);
      await load();
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setBusy(false);
    }
  };
  const generateAll = () => run(() => api.post("/admin/test-tickets/generate-all"), "6 test tickets generated");
  const wipe = () => {
    if (!window.confirm("Delete all test tickets? Real tickets, orders and QR codes stay untouched.")) return;
    run(() => api.delete("/admin/test-tickets"), "Test data deleted");
  };

  const used = list.filter((t) => t.status === "used").length;

  return (
    <div className={`${cardCls} border-dashed border-[#FF6A00]/40`} data-testid="test-mode-card">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <p className="font-mono2 text-xs uppercase tracking-[0.25em] text-[#FF6A00] flex items-center gap-2">
          <FlaskConical size={14} /> Test mode — private
        </p>
        <div className="flex gap-2">
          <button onClick={generateAll} disabled={busy} className={`${actBtn} disabled:opacity-50`} data-testid="test-generate-all">
            {busy ? "Working…" : "Generate all test tickets"}
          </button>
          <button onClick={wipe} disabled={busy || list.length === 0} className={`${actBtn} disabled:opacity-40`} data-testid="test-delete-all">
            <Trash2 size={12} className="inline mr-1" />Delete test data
          </button>
        </div>
      </div>
      <p className="font-mono2 text-[10px] text-slate-500 mb-5">
        Only visible here in admin — never on the public site. Test QR codes go through the real scanner
        (first scan accepted, second declined) but touch no orders, revenue, ticket sales, check-ins,
        statistics, payments, discount-code usage, ambassador sales or capacity.
      </p>

      {list.length > 0 && (
        <p className="font-mono2 text-[11px] text-slate-400 mb-3" data-testid="test-summary">
          {list.length} test ticket(s) · {used} already scanned · {list.length - used} still valid
          {list[0]?.created_at ? ` · last generated ${fmtDate(list[0].created_at)}` : ""}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2" data-testid="test-ticket-list">
        {list.map((t) => <TestRow key={t.code} t={t} />)}
        {list.length === 0 && <p className="text-slate-600 text-xs font-mono2">No test tickets — click “Generate all test tickets”.</p>}
      </div>
    </div>
  );
}
