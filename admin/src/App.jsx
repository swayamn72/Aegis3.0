import { Routes, Route } from "react-router-dom";
import AdminLogin from "./pages/adminLogin";
import AdminDashboard from "./pages/adminDashboard";
import AdminOrganizations from "./pages/adminOrganizations";
import AdminMatches from "./pages/adminMatches";
import AdminTournaments from "./pages/adminTournaments";
import AdminReports from "./pages/adminReports";
import AdminPlayers from "./pages/adminPlayers";
import AdminLiveScoring from "./pages/adminLiveScoring";
import AdminTournamentCreate from "./pages/adminTournamentCreate";
import AdminTournamentDetail from "./pages/adminTournamentDetail";
import AdminFantasy from "./pages/adminFantasy";
import ProtectedRoute from "./components/protectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/organizations" element={<ProtectedRoute><AdminOrganizations /></ProtectedRoute>} />
      <Route path="/admin/matches" element={<ProtectedRoute><AdminMatches /></ProtectedRoute>} />
      <Route path="/admin/tournaments" element={<ProtectedRoute><AdminTournaments /></ProtectedRoute>} />
      <Route path="/admin/tournaments/create" element={<ProtectedRoute><AdminTournamentCreate /></ProtectedRoute>} />
      <Route path="/admin/tournaments/:id" element={<ProtectedRoute><AdminTournamentDetail /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/players" element={<ProtectedRoute><AdminPlayers /></ProtectedRoute>} />
      <Route path="/admin/live-scoring" element={<ProtectedRoute><AdminLiveScoring /></ProtectedRoute>} />
      <Route path="/admin/fantasy" element={<ProtectedRoute><AdminFantasy /></ProtectedRoute>} />
    </Routes>
  );
}
