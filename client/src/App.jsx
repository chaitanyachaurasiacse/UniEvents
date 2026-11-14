import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Shell } from "./components/Shell";
import { SignIn } from "./pages/auth/SignIn";
import { Register, Forgot, Reset } from "./pages/auth/AuthPages";
import { Landing } from "./pages/Landing";
import { Certificate } from "./pages/Certificate";

export function App() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) return <div className="loading" style={{ minHeight: '100vh', borderRadius: 0 }} aria-label="Loading UniEvents" />;
  if (pathname.startsWith('/certificate/')) return <Routes><Route path="/certificate/:code" element={<Certificate />} /></Routes>;
  if (user) return ['/signin', '/register'].includes(pathname) ? <Navigate to="/" replace /> : <Shell />;
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />
      <Route path="*" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
