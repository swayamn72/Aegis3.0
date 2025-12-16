import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./config/queryClient";
import "./App.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import SignupPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import AegisProfileCompletionPage from "./pages/AegisProfileCompletionPage";
import HomePage from "./pages/HomePage";
import MyTeamsPage from "./pages/MyTeamsPage";
import DetailedTeamInfoPage from "./pages/DetailedTeamInfoPage";
import ChatPage from "./pages/ChatPage";
import RecruitmentActualPage from "./pages/RecruitmentActualPage";
import SettingsPage from "./pages/SettingsPage";
import MyProfilePage from "./pages/MyProfilePage";
import PlayersPage from "./pages/PlayersPage";
import TournamentsPage from "./pages/TournamentsPage";
import DetailedTournamentInfoPage from './pages/DetailedTournamentInfoPage';
import TournamentManagementPageOrg from "./orgs/TournamentManagementPageOrg";

import AegisOrgPendingApproval from "./orgs/OrgPendingApproval";
import OrgDashboard from "./orgs/OrgDashboard"; 

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop={false} closeOnClick pauseOnFocusLoss draggable pauseOnHover />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

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
              path="/complete-profile"
              element={
                <ProtectedRoute requireRole="player">
                  <AegisProfileCompletionPage />
                </ProtectedRoute>
              }
            />
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
              path="/players"
              element={
                <ProtectedRoute requireRole="player">
                  <PlayersPage />
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
          </Routes>
        </BrowserRouter>
      </AuthProvider>

      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
