import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import TicketsPage from "@/pages/TicketsPage";
import Success from "@/pages/Success";
import PaySim from "@/pages/PaySim";
import Admin from "@/pages/Admin";
import Scanner from "@/pages/Scanner";
import CookieBanner from "@/components/CookieBanner";
import { captureAttribution, initPixel, marketingAllowed, trackEvent } from "@/lib/tracking";

function RouteTracker() {
  const loc = useLocation();
  useEffect(() => {
    captureAttribution();
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
        <Route path="/" element={<Landing />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/success" element={<Success />} />
        <Route path="/pay/:orderId" element={<PaySim />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/nascanujtobrasko" element={<Scanner />} />
      </Routes>
    </BrowserRouter>
  );
}
