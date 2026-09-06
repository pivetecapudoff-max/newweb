import { Navigate, Route, Routes } from "react-router-dom";
import { AccountPage } from "./pages/AccountPage";
import { AppShell } from "./pages/AppShell";
import { ClusterPage } from "./pages/ClusterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { Feed } from "./pages/Feed";
import { Landing } from "./pages/Landing";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";

import { AiAssistantView } from "./pages/AiAssistantView";
import { UgcCreatorView } from "./pages/UgcCreatorView";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CopyPage } from "./pages/CopyPage";
import { GamepassAutoPage } from "./pages/GamepassAutoPage";
import { SilkShaderBackground } from "./components/SilkShaderBackground";
import { AuthGuard } from "./components/AuthGuard";
import { LoginPage } from "./pages/LoginPage";
import { CloudflareGate } from "./components/CloudflareGate";

export function App() {
  return (
    <CloudflareGate>
      <div className="relative min-h-screen w-full bg-[#02010A] text-white">
        <SilkShaderBackground fixed={true} />
        <div className="relative z-10 w-full h-full" style={{ position: "relative", zIndex: 10 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthGuard />}>
            <Route path="/painel" element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="overview" element={<DashboardPage />} />
              <Route path="chat" element={<AiAssistantView />} />
              <Route path="assistant" element={<AiAssistantView />} />
              <Route path="ai" element={<AiAssistantView />} />
              <Route path="ugc-creator" element={<UgcCreatorView />} />
              <Route path="create-ugc" element={<UgcCreatorView />} />
              <Route path="ugc-ai" element={<UgcCreatorView />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="consultoria" element={<AnalyticsPage />} />
              <Route path="copy" element={<CopyPage />} />
              <Route path="gamepass" element={<GamepassAutoPage />} />
              <Route path="feed" element={<Feed />} />
              <Route path="upload" element={<UploadPage />} />
              <Route path="tema/:id" element={<ClusterPage />} />
              <Route path="ajustes" element={<SettingsPage />} />
              <Route path="conta" element={<AccountPage />} />
              <Route path="account" element={<AccountPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  </CloudflareGate>
  );
}
