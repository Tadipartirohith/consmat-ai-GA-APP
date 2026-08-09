import { createContext, useContext, useEffect, useState } from "react";
import {
  loginRequest,
  setToken,
  clearToken,
  getToken,
  getStoredUser,
  setStoredUser,
} from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const login = async (email, password) => {
    const { data } = await loginRequest(email, password);
    const token = data.access_token || data.token;
    if (!token) throw new Error("No access token returned by server");
    setToken(token);
    const u = data.user || { email, role: data.role };
    setStoredUser(u);
    setUser(u);
    return u;
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  const isAuthenticated = !!getToken() && !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, ready }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
