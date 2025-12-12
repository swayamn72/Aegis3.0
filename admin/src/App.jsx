import { Routes, Route } from "react-router-dom";
import AdminLogin from "./pages/adminLogin";
import AdminDashboard from "./pages/adminDashboard";
import AdminOrganizations from "./pages/adminOrganizations";
import AdminMatches from "./pages/adminMatches";
import AdminRewards from "./pages/adminRewards";
import ProtectedRoute from "./components/protectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLogin />} />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/organizations"
        element={
          <ProtectedRoute>
            <AdminOrganizations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/matches"
        element={
          <ProtectedRoute>
            <AdminMatches />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/rewards"
        element={
          <ProtectedRoute>
            <AdminRewards />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
