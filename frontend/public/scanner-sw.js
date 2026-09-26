// Minimal service worker: it exists so the door scanner can be installed as a standalone app.
// It deliberately does NOT cache anything — every request goes to the network, so the scanner can
// never serve a stale bundle and can never "admit" anyone while offline.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
