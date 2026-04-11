import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Privacy from "./pages/Privacy";
import NotFound from "./pages/NotFound";
import CheckinPage from "./pages/CheckinPage";
import { isLegacyMode } from "./lib/checkin-config";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Legacy-Modus: Root-Route zeigt direkt das Formular (AKZ-Standorte) */}
          {isLegacyMode() && <Route path="/" element={<Index />} />}

          {/* Aurora Starter: Tenant + optionale Filiale aus URL */}
          <Route path="/:tenant" element={<CheckinPage />} />
          <Route path="/:tenant/:filiale" element={<CheckinPage />} />

          <Route path="/privacy" element={<Privacy />} />

          {/* Fallback: Ohne Tenant → Fehlerseite oder Legacy */}
          <Route path="/" element={isLegacyMode() ? <Index /> : <NotFound />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
