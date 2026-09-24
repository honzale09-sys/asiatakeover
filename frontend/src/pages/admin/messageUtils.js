export const MSG_STATUSES = ["new", "contacted", "confirmed", "declined"];
export const MSG_STATUS_STYLES = {
  new: "text-[#00F0FF] border-[#00F0FF]/40",
  contacted: "text-[#FFE600] border-[#FFE600]/40",
  confirmed: "text-green-400 border-green-400/40",
  declined: "text-[#FF0055] border-[#FF0055]/40",
};
export const ASSIGNABLE_FLOORS = ["Seoul Floor (7th)", "Saigon Floor (5th)"];

export function floorKey(f) {
  const x = (f || "").toLowerCase();
  if (x.includes("saigon") || x.includes("5th")) return "saigon";
  if (x.includes("mainstream") || x.includes("6th")) return "mainstream";
  if (x.includes("seoul") || x.includes("7th")) return "seoul";
  return "other";
}

function matchesStatus(m, statusF) {
  if (statusF === "removed") return !!m.removed;
  if (m.removed) return false;
  return statusF === "all" || (m.status || "new") === statusF;
}

function matchesGuests(m, minG, maxG) {
  if ((minG !== "" || maxG !== "") && m.guests == null) return false;
  if (minG !== "" && (m.guests || 0) < Number(minG)) return false;
  if (maxG !== "" && (m.guests || 0) > Number(maxG)) return false;
  return true;
}

function matchesSearch(m, search) {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return `${m.name || ""} ${m.email || ""} ${m.phone || ""}`.toLowerCase().includes(q);
}

const SORTERS = {
  oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
  "guests-asc": (a, b) => (a.guests || 0) - (b.guests || 0),
  "guests-desc": (a, b) => (b.guests || 0) - (a.guests || 0),
  newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
};

export function filterMessages(messages, { statusF, floor, minG, maxG, search, sort }) {
  return messages
    .filter((m) => matchesStatus(m, statusF) && (floor === "all" || floorKey(m.floor) === floor) && matchesGuests(m, minG, maxG) && matchesSearch(m, search))
    .sort(SORTERS[sort] || SORTERS.newest);
}
