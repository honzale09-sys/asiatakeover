import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import TicketsPage from "@/pages/TicketsPage";
import Success from "@/pages/Success";
import PaySim from "@/pages/PaySim";
import Terms from "@/pages/Terms";
import ContactPage from "@/pages/ContactPage";
import FaqPage from "@/pages/FaqPage";
import GalleryPage from "@/pages/GalleryPage";
import ReservePage from "@/pages/ReservePage";
import PrivacyPage from "@/pages/PrivacyPage";
import UpgradePage from "@/pages/UpgradePage";
import Admin from "@/pages/Admin";
import Scanner from "@/pages/Scanner";
import CookieBanner from "@/components/CookieBanner";
import Lockdown from "@/components/Lockdown";
import { LangProvider, useT, LANG_CODES } from "@/i18n";
import { captureAttribution, getConsent, initGTM, initPixel, marketingAllowed, trackEvent } from "@/lib/tracking";

function RouteTracker() {
  const loc = useLocation();
  useEffect(() => {
    captureAttribution();
    const c = getConsent();
    if (c?.analytics || c?.marketing) initGTM();
    if (marketingAllowed()) {
      const alreadyLoaded = !!window.fbq;
      initPixel();
      if (alreadyLoaded) trackEvent("PageView");
    }
  }, [loc.pathname, loc.search]);
  return null;
}

const NO_PREFIX = ["admin", "nascanujtobrasko"];

function LangSync() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { lang, setLang, setUrlLang } = useT();
  useEffect(() => {
    const seg = pathname.split("/")[1] || "";
    if (LANG_CODES.includes(seg)) {
      setUrlLang(seg);
      if (seg !== lang) setLang(seg);
      return;
    }
    setUrlLang(null);
    if (NO_PREFIX.includes(seg)) return;
    const saved = localStorage.getItem("atf_lang");
    if (saved && saved !== "en" && LANG_CODES.includes(saved)) {
      navigate(`/${saved}${pathname === "/" ? "" : pathname}`, { replace: true });
    }
  }, [pathname, lang, navigate, setLang, setUrlLang]);
  return null;
}

function LangGuard({ children }) {
  const { lang } = useParams();
  const { pathname } = useLocation();
  if (lang && !LANG_CODES.includes(lang)) {
    const rest = pathname.slice(lang.length + 1) || "/";
    return <Navigate to={rest} replace />;
  }
  return children;
}

const PUBLIC_ROUTES = [
  ["/", <Landing />],
  ["/tickets", <TicketsPage />],
  ["/success", <Success />],
  ["/pay/:orderId", <PaySim />],
  ["/terms", <Terms />],
  ["/contact", <ContactPage />],
  ["/faq", <FaqPage />],
  ["/gallery", <GalleryPage />],
  ["/reserve", <ReservePage />],
  ["/upgrade", <UpgradePage />],
  ["/privacy", <PrivacyPage />],
];

export default function App() {
  return (
    <LangProvider>
    <BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors />
      <RouteTracker />
      <LangSync />
      <CookieBanner />
      <Routes>
        {PUBLIC_ROUTES.map(([path, el]) => (
          <Route key={path} path={path} element={<Lockdown>{el}</Lockdown>} />
        ))}
        {PUBLIC_ROUTES.map(([path, el]) => (
          <Route
            key={`lang:${path}`}
            path={`/:lang${path === "/" ? "" : path}`}
            element={<LangGuard><Lockdown>{el}</Lockdown></LangGuard>}
          />
        ))}
        <Route path="/admin" element={<Admin />} />
        <Route path="/nascanujtobrasko" element={<Scanner />} />
      </Routes>
    </BrowserRouter>
    </LangProvider>
  );
}
