import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./App.css";

import SignupPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import AegisProfileCompletionPage from "./pages/AegisProfileCompletionPage";
import HomePage from "./pages/HomePage";
import MyTeamsPage from "./pages/MyTeamsPage";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// ✅ Create QueryClient with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // ✅ Data never becomes stale - only refetch on manual invalidation
      gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
      refetchOnWindowFocus: false, // ✅ Never refetch on window focus
      refetchOnMount: false, // ✅ Never refetch on component mount - use cache
      refetchOnReconnect: false, // ✅ Never refetch on network reconnect
      retry: 1, // Retry failed requests once
    },
  },
});

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
          </Routes>
        </BrowserRouter>
      </AuthProvider>

      {/* ✅ React Query Devtools - only in development */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}

export default App;
