import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Operator from "@/pages/Operator";

function RequireOperator({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RedirectIfAuthed({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/operator" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <RedirectIfAuthed>
                  <Login />
                </RedirectIfAuthed>
              }
            />
            <Route
              path="/operator"
              element={
                <RequireOperator>
                  <Operator />
                </RequireOperator>
              }
            />
            <Route path="*" element={<Navigate to="/operator" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: "#171c22",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
              borderRadius: 0,
              fontFamily: "'IBM Plex Sans', sans-serif",
            },
          }}
        />
      </AuthProvider>
    </div>
  );
}

export default App;
