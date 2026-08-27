import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "@/pages/Landing";
import TicketsPage from "@/pages/TicketsPage";
import Admin from "@/pages/Admin";
import Scanner from "@/pages/Scanner";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/tickets" element={<TicketsPage />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/nascanujtobrasko" element={<Scanner />} />
      </Routes>
    </BrowserRouter>
  );
}
