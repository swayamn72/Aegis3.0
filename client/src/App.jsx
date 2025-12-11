import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "./config/queryClient";
import "./App.css";

import SignupPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import AegisProfileCompletionPage from "./pages/AegisProfileCompletionPage";
import HomePage from "./pages/HomePage";
import MyTeamsPage from "./pages/MyTeamsPage";
import DetailedTeamInfoPage from "./pages/DetailedTeamInfoPage";
import ChatPage from "./pages/ChatPage";
import RecruitmentActualPage from "./pages/RecruitmentActualPage";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Protected Route */}
            <Route path="/complete-profile" element={<ProtectedRoute><AegisProfileCompletionPage /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/my-teams" element={<ProtectedRoute><MyTeamsPage /></ProtectedRoute>} />
            <Route path="/team/:id" element={<ProtectedRoute><DetailedTeamInfoPage /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/recruitment" element={<ProtectedRoute><RecruitmentActualPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>

      {/* ✅ React Query Devtools - only in development */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
