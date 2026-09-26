import { useEffect } from "react";

const APPLE_METAS = [
  ["apple-mobile-web-app-capable", "yes"],
  ["mobile-web-app-capable", "yes"],
  ["apple-mobile-web-app-status-bar-style", "black-translucent"],
  ["apple-mobile-web-app-title", "Door Control"],
];

/** Makes /nascanujtobrasko installable as a standalone Door Control app (iPhone + Android)
 *  without turning the public ticket site into an installable app. */
export function usePwaShell() {
  useEffect(() => {
    const added = [];
    const add = (tag, attrs) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      added.push(el);
    };

    add("link", { rel: "manifest", href: "/scanner.webmanifest" });
    add("link", { rel: "apple-touch-icon", sizes: "180x180", href: "/assets/door-icon-180.png" });
    APPLE_METAS.forEach(([name, content]) => add("meta", { name, content }));

    const viewport = document.querySelector('meta[name="viewport"]');
    const prevViewport = viewport?.getAttribute("content");
    viewport?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/scanner-sw.js")
        .catch((e) => console.warn("Scanner: service worker registration failed", e));
    }

    return () => {
      added.forEach((el) => el.remove());
      if (viewport && prevViewport) viewport.setAttribute("content", prevViewport);
    };
  }, []);
}
