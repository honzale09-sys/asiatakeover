const LS_CONSENT = "atf_consent_v1";
const LS_FIRST = "atf_attr_first";
const LS_LAST = "atf_attr_last";

export function getConsent() {
  try {
    return JSON.parse(localStorage.getItem(LS_CONSENT));
  } catch {
    return null;
  }
}

export function marketingAllowed() {
  return !!getConsent()?.marketing;
}

export function saveConsent({ analytics = false, marketing = false }) {
  localStorage.setItem(
    LS_CONSENT,
    JSON.stringify({ necessary: true, analytics, marketing, ts: Date.now() })
  );
  if (marketing) initPixel();
}

export function getCookie(name) {
  const m = document.cookie.split("; ").find((x) => x.startsWith(`${name}=`));
  return m ? decodeURIComponent(m.split("=").slice(1).join("=")) : null;
}

export function initPixel() {
  const pixelId = process.env.REACT_APP_META_PIXEL_ID;
  if (!pixelId || window.fbq) return;
  const n = function (...args) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  };
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
  window._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  n("consent", "grant");
  n("init", pixelId);
  n("track", "PageView");
}

export function trackEvent(name, data = {}, eventID = null) {
  if (!window.fbq || !marketingAllowed()) return;
  if (eventID) window.fbq("track", name, data, { eventID });
  else window.fbq("track", name, data);
}

export function captureAttribution() {
  const p = new URLSearchParams(window.location.search);
  const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid"];
  const found = {};
  keys.forEach((k) => {
    const v = p.get(k);
    if (v) found[k] = v;
  });
  if (Object.keys(found).length > 0) {
    if (!localStorage.getItem(LS_FIRST)) {
      localStorage.setItem(LS_FIRST, JSON.stringify({ ...found, ts: Date.now() }));
    }
    localStorage.setItem(LS_LAST, JSON.stringify({ ...found, ts: Date.now() }));
  }
  if (found.fbclid && !getCookie("_fbc")) {
    const fbc = `fb.1.${Date.now()}.${found.fbclid}`;
    document.cookie = `_fbc=${encodeURIComponent(fbc)}; path=/; max-age=63072000; samesite=lax`;
  }
}

function parseLS(k) {
  try {
    return JSON.parse(localStorage.getItem(k));
  } catch {
    return null;
  }
}

export function buildOrderAttribution() {
  return {
    first_touch: parseLS(LS_FIRST),
    last_touch: parseLS(LS_LAST),
    fbp: getCookie("_fbp"),
    fbc: getCookie("_fbc"),
    event_source_url: window.location.origin + "/tickets",
  };
}
