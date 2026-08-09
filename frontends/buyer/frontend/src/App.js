import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "@/context/AppContext";
import { Toaster } from "sonner";
import Login from "@/pages/Login";
import Home from "@/pages/Home";

function Protected({ children }) {
  const { token } = useApp();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function PublicOnly({ children }) {
  const { token } = useApp();
  if (token) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App min-h-screen bg-[#0f1216] text-white">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <Login />
                </PublicOnly>
              }
            />
            <Route
              path="/"
              element={
                <Protected>
                  <Home />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: { background: "#171c22", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" },
          }}
        />
      </AppProvider>
    </div>
  );
}

export default App;
