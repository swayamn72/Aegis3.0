import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import SignupPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import AegisProfileCompletionPage from "./pages/AegisProfileCompletionPage";
import HomePage from "./pages/HomePage";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute"; // <-- ADD THIS

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          {/* Protected Route */}
          <Route path="/complete-profile" element={<ProtectedRoute><AegisProfileCompletionPage /></ProtectedRoute>}/>
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
