import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/AdminLayout";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Vendors from "@/pages/Vendors";
import Orders from "@/pages/Orders";
import Logistics from "@/pages/Logistics";
import Support from "@/pages/Support";

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-cm-bg text-cm-muted">
      <Loader2 className="animate-spin text-cm-accent" size={28} />
    </div>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === undefined) return <FullScreenLoader />;
  if (user) return <Navigate to="/admin" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route
              path="/admin"
              element={<Protected><AdminLayout /></Protected>}
            >
              <Route index element={<Overview />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="orders" element={<Orders />} />
              <Route path="support" element={<Support />} />
              <Route path="logistics" element={<Logistics />} />
            </Route>
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" theme="dark" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
