import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AnalysisDetails from "./pages/AnalysisDetails";
import History from "./pages/History";
import HistoryTimeline from "./pages/HistoryTimeline";
import FileRiskDetails from "./pages/FileRiskDetails";
import GitIntegration from "./pages/GitIntegration";
import VersionCompare from "./pages/VersionCompare";
import Projects from "./pages/Projects";
import HeatmapPage from "./pages/HeatmapPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/analise" element={<AnalysisDetails />} />
          <Route path="/arquivo" element={<FileRiskDetails />} />
          <Route path="/historico" element={<History />} />
          <Route path="/timeline" element={<HistoryTimeline />} />
          <Route path="/git" element={<GitIntegration />} />
          <Route path="/comparar" element={<VersionCompare />} />
          <Route path="/projetos" element={<Projects />} />
          <Route path="/projeto/:id" element={<Projects />} />
          <Route path="/heatmap" element={<HeatmapPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
