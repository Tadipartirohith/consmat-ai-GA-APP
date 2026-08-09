import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStore, apiErrorMessage } from "@/lib/api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  // undefined = checking, null = logged out, object = logged in
  const [user, setUser] = useState(undefined);

  const bootstrap = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      tokenStore.set(data.access_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: apiErrorMessage(e) };
    }
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
