import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
import Admin from "@/pages/Admin";
import Scanner from "@/pages/Scanner";
import CookieBanner from "@/components/CookieBanner";
import Lockdown from "@/components/Lockdown";
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

export default function App() {
  return (
    <BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors />
      <RouteTracker />
      <CookieBanner />
      <Routes>
        <Route path="/" element={<Lockdown><Landing /></Lockdown>} />
        <Route path="/tickets" element={<Lockdown><TicketsPage /></Lockdown>} />
        <Route path="/success" element={<Lockdown><Success /></Lockdown>} />
        <Route path="/pay/:orderId" element={<Lockdown><PaySim /></Lockdown>} />
        <Route path="/terms" element={<Lockdown><Terms /></Lockdown>} />
        <Route path="/contact" element={<Lockdown><ContactPage /></Lockdown>} />
        <Route path="/faq" element={<Lockdown><FaqPage /></Lockdown>} />
        <Route path="/gallery" element={<Lockdown><GalleryPage /></Lockdown>} />
        <Route path="/reserve" element={<Lockdown><ReservePage /></Lockdown>} />
        <Route path="/privacy" element={<Lockdown><PrivacyPage /></Lockdown>} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/nascanujtobrasko" element={<Scanner />} />
      </Routes>
    </BrowserRouter>
  );
}
