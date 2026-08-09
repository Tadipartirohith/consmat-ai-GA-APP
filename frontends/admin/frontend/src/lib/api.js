import axios from "axios";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api/v1`;

export const api = axios.create({ baseURL: BASE });

const TOKEN_KEY = "consmat_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function apiErrorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export const formatINR = (n) => {
  const num = Number(n) || 0;
  return "\u20B9" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
};

export const compactINR = (n) => {
  const num = Number(n) || 0;
  if (num >= 1e7) return "\u20B9" + (num / 1e7).toFixed(2) + " Cr";
  if (num >= 1e5) return "\u20B9" + (num / 1e5).toFixed(2) + " L";
  return "\u20B9" + num.toLocaleString("en-IN");
};
