import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { loading, profile } = useAuth();
  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (profile?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}
