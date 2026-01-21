import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OAuthCallback from "./pages/OAuthCallback";
import Profile from "./pages/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/cadastro" element={<Register />} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route path="/auth/github/callback" element={<OAuthCallback />} />
            <Route path="/auth/google/callback" element={<OAuthCallback />} />
            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/analise" element={<ProtectedRoute><AnalysisDetails /></ProtectedRoute>} />
            <Route path="/arquivo" element={<ProtectedRoute><FileRiskDetails /></ProtectedRoute>} />
            <Route path="/historico" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><HistoryTimeline /></ProtectedRoute>} />
            <Route path="/git" element={<ProtectedRoute><GitIntegration /></ProtectedRoute>} />
            <Route path="/comparar" element={<ProtectedRoute><VersionCompare /></ProtectedRoute>} />
            <Route path="/projetos" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/projeto/:id" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
            <Route path="/heatmap" element={<ProtectedRoute><HeatmapPage /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
