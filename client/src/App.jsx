import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./config/queryClient";
import "./App.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { lazy, Suspense } from "react";

// --- Core (always loaded) ---
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import { useAuth } from "./context/AuthContext";

// --- Auth pages (small, loaded eagerly for fast first paint) ---
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignUpPage";

// --- Heavy pages (lazy loaded — only fetched when navigated to) ---
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const EmailVerification = lazy(() => import("./pages/EmailVerification"));
const UsernameSetup = lazy(() => import("./pages/UsernameSetup"));
const OrgProfileSetup = lazy(() => import("./pages/OrgProfileSetup"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MyTeamsPage = lazy(() => import("./pages/MyTeamsPage"));
const DetailedTeamInfoPage = lazy(() => import("./pages/DetailedTeamInfoPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const RecruitmentActualPage = lazy(() => import("./pages/RecruitmentActualPage"));
const FindPlayersPage = lazy(() => import("./pages/FindPlayersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const MyProfilePage = lazy(() => import("./pages/MyProfilePage"));
const MyGameIdsPage = lazy(() => import("./pages/MyGameIdsPage"));
const TournamentsPage = lazy(() => import("./pages/TournamentsPage"));
const DetailedTournamentInfoPage = lazy(() => import('./pages/DetailedTournamentInfoPage'));
const DetailedMatchInfoPage = lazy(() => import('./pages/DetailedMatchInfoPage'));
const TournamentManagementPageOrg = lazy(() => import("./orgs/TournamentManagementPageOrg"));
const DetailedPlayerProfilePage = lazy(() => import("./pages/DetailedPlayerProfilePage"));
const AegisLeaderboard = lazy(() => import("./components/AegisLeaderboard"));
const AegisOrgPendingApproval = lazy(() => import("./orgs/OrgPendingApproval"));
const OrgDashboard = lazy(() => import("./orgs/OrgDashboard"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));

// --- Loading fallback for lazy-loaded routes ---
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0a0a23' }}>
    <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.3)', borderTop: '3px solid #3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Wrapper component to access auth context
function AppContent() {
  const { user } = useAuth();

  return (
    <SocketProvider userId={user?._id}>
      <BrowserRouter>
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick pauseOnFocusLoss draggable pauseOnHover />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
            <Route path="/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="/organization/reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
            <Route path="/verify-email" element={<EmailVerification />} />
            <Route path="/setup-username" element={<UsernameSetup />} />
            <Route path="/org-profile-setup" element={<OrgProfileSetup />} />
            <Route path="/detailed/:id" element={<DetailedPlayerProfilePage />} />
            <Route path="/matches/:id" element={<DetailedMatchInfoPage />} />
            <Route path="/leaderboard" element={<AegisLeaderboard />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

            {/* Organization Routes */}
            <Route
              path="/org/pending-approval"
              element={
                <ProtectedRoute requireRole="organization">
                  <AegisOrgPendingApproval />
                </ProtectedRoute>
              }
            />
            <Route
              path="/org/dashboard"
              element={
                <ProtectedRoute requireRole="organization">
                  <OrgDashboard />
                </ProtectedRoute>
              }
            />

            {/* Player-Only Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute requireRole="player">
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-teams"
              element={
                <ProtectedRoute requireRole="player">
                  <MyTeamsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team/:id"
              element={
                <ProtectedRoute requireRole="player">
                  <DetailedTeamInfoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute requireRole="player">
                  <ChatPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruitment"
              element={
                <ProtectedRoute requireRole="player">
                  <RecruitmentActualPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/find-players"
              element={
                <ProtectedRoute requireRole="player">
                  <FindPlayersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requireRole="player">
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-profile"
              element={
                <ProtectedRoute requireRole="player">
                  <MyProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-game-ids"
              element={
                <ProtectedRoute requireRole="player">
                  <MyGameIdsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournaments"
              element={
                <ProtectedRoute requireRole="player">
                  <TournamentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tournament/:id"
              element={
                <ProtectedRoute requireRole="player">
                  <DetailedTournamentInfoPage />
                </ProtectedRoute>
              }
            />
            <Route path="/org/tournament/:id" element={<ProtectedRoute requireRole="organization"><TournamentManagementPageOrg /></ProtectedRoute>} />

            {/* 404 Catch-all Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </SocketProvider>
  );
}
// Lazy load DevTools — only loaded in dev builds
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() => import("@tanstack/react-query-devtools").then(m => ({ default: m.ReactQueryDevtools })))
  : () => null;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      {import.meta.env.DEV && (
        <Suspense fallback={null}>
          <ReactQueryDevtools initialIsOpen={false} />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

export default App;
