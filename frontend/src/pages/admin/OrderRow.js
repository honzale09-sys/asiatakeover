import { czk } from "@/api";
import { fmtDate, shortId } from "./shared";
import { categoryLabel, isPaid, isPending, paymentStatusCls } from "./orderUtils";

function CategoryBadge({ o }) {
  const vip = /vip/i.test(o.tier_name || "");
  return (
    <span className={`font-mono2 text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${vip ? "border-[#C9A227]/50 text-[#C9A227]" : "border-[#00F0FF]/40 text-[#00F0FF]"}`}>
      {categoryLabel(o)}
    </span>
  );
}

function PaymentCell({ o, onSync }) {
  const sid = shortId(o.id);
  const guestUsed = o.tickets?.[0]?.status === "used";
  return (
    <td className="px-4 py-3">
      {o.guest_list ? (
        <span className={`font-mono2 text-[11px] font-bold uppercase tracking-wider ${guestUsed ? "text-emerald-400" : "text-[#C9A227]"}`} data-testid={`order-status-${sid}`}>
          {guestUsed ? "Checked In" : "Sent"}
        </span>
      ) : (
        <span className={`font-mono2 text-[11px] uppercase tracking-wider ${paymentStatusCls(o.payment_status)}`} data-testid={`order-status-${sid}`}>
          {o.payment_status}
        </span>
      )}
      {o.paid_at && <p className="font-mono2 text-[10px] text-slate-600 mt-0.5">paid {fmtDate(o.paid_at)}</p>}
      {o.gopay_payment_id && <p className="font-mono2 text-[10px] text-slate-600">gw {o.gopay_payment_id}</p>}
      {o.teya_session_id && <p className="font-mono2 text-[10px] text-slate-600">teya {o.teya_session_id}</p>}
      {isPending(o) && o.teya_session_id && (
        <button onClick={() => onSync(o.id)} data-testid={`sync-payment-${sid}`} className="mt-1 font-mono2 text-[11px] text-[#00F0FF] hover:underline">
          sync payment
        </button>
      )}
    </td>
  );
}

function MarketingCell({ o }) {
  const lt = o.attribution?.last_touch || {};
  const bits = [lt.utm_source, lt.utm_medium, lt.utm_campaign, lt.utm_content, lt.utm_term].filter(Boolean);
  const hasMeta = !!(o.attribution?.fbc || lt.fbclid);
  return (
    <td className="px-4 py-3 font-mono2 text-[11px] text-slate-400" data-testid={`order-marketing-${shortId(o.id)}`}>
      {bits.length > 0 ? <p>{bits.join(" / ")}</p> : <p className="text-slate-600">direct</p>}
      {hasMeta && <p className="text-[#00F0FF] mt-0.5">meta click ✓</p>}
    </td>
  );
}

function EmailStatus({ o }) {
  if (o.ticket_email_sent_at) return <span className="text-emerald-400">sent {fmtDate(o.ticket_email_sent_at)}</span>;
  if (o.ticket_email_error) return <span className="text-[#FF0055]">error: {o.ticket_email_error}</span>;
  return <span className="text-slate-600">—</span>;
}

function EmailCell({ o, onResend, onDelete }) {
  const sid = shortId(o.id);
  return (
    <td className="px-4 py-3 font-mono2 text-[11px]" data-testid={`order-email-${sid}`}>
      <EmailStatus o={o} />
      {isPaid(o) && (
        <button onClick={() => onResend(o.id)} data-testid={`resend-email-${sid}`} className="block mt-1 text-[#00F0FF] hover:underline">
          resend tickets
        </button>
      )}
      <button onClick={() => onDelete(o.id)} data-testid={`delete-order-${sid}`} className="block mt-1 text-[#FF0055] hover:underline">
        delete
      </button>
    </td>
  );
}

export function OrderRow({ o, ambNames, onSync, onResend, onDelete }) {
  const sid = shortId(o.id);
  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.03]" data-testid={`order-row-${sid}`}>
      <td className="px-4 py-3 font-mono2 text-xs text-slate-400 whitespace-nowrap">{fmtDate(o.created_at)}</td>
      <td className="px-4 py-3">
        <p className="font-medium">{o.buyer_name}</p>
        <p className="font-mono2 text-xs text-slate-500">{o.buyer_email}</p>
        {o.buyer_phone && <p className="font-mono2 text-xs text-slate-500" data-testid={`order-phone-${sid}`}>{o.buyer_phone}</p>}
      </td>
      <td className="px-4 py-3 whitespace-nowrap" data-testid={`order-category-${sid}`}>
        <CategoryBadge o={o} />
      </td>
      <td className="px-4 py-3 text-[#00F0FF] font-mono2 text-xs whitespace-nowrap">{o.tier_name}</td>
      <td className="px-4 py-3">{o.quantity}</td>
      <td className="px-4 py-3 text-[#FFE600] font-mono2 text-xs whitespace-nowrap">
        {czk(o.amount_czk)}
        {o.promo_code && (
          <p className="text-[10px] text-slate-500 mt-0.5" data-testid={`order-promo-${sid}`}>
            {o.promo_code}{ambNames[o.promo_code] ? ` · ${ambNames[o.promo_code]}` : ""}
          </p>
        )}
      </td>
      <td className="px-4 py-3 font-mono2 text-xs text-slate-400">
        {o.tickets.map((t) => (
          <span key={t.code} className={`inline-block mr-2 ${t.status === "used" ? "line-through text-slate-600" : ""}`}>{t.code}</span>
        ))}
      </td>
      <PaymentCell o={o} onSync={onSync} />
      <MarketingCell o={o} />
      <EmailCell o={o} onResend={onResend} onDelete={onDelete} />
    </tr>
  );
}
