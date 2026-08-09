import axios from "axios";

const API_BASE_KEY = "vendor_api_base";
const TOKEN_KEY = "vendor_token";
const USER_KEY = "vendor_user";
const THRESHOLD_KEY = "vendor_low_stock_threshold";

export const getApiBase = () =>
  localStorage.getItem(API_BASE_KEY) || process.env.REACT_APP_API_BASE_URL || "";
export const setApiBase = (v) => localStorage.setItem(API_BASE_KEY, (v || "").trim());

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};
export const setStoredUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));

export const getLowStockThreshold = () => {
  const v = parseInt(localStorage.getItem(THRESHOLD_KEY), 10);
  return Number.isFinite(v) ? v : 10;
};
export const setLowStockThreshold = (v) =>
  localStorage.setItem(THRESHOLD_KEY, String(v));

const RESTOCK_PRESET_KEY = "vendor_restock_preset";
export const getRestockPreset = () => {
  const v = parseInt(localStorage.getItem(RESTOCK_PRESET_KEY), 10);
  return Number.isFinite(v) ? v : null;
};
export const setRestockPreset = (v) => localStorage.setItem(RESTOCK_PRESET_KEY, String(v));

const api = axios.create();

api.interceptors.request.use((config) => {
  const base = getApiBase().replace(/\/$/, "");
  config.baseURL = `${base}/api/v1`;
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- API calls ----
export const loginRequest = (email, password) =>
  api.post("/auth/login", { email, password });

export const registerVendor = (payload) => api.post("/vendors/register", payload);

export const getVendorMe = () => api.get("/vendors/me");

export const updateOffer = (offer) => api.put("/vendors/me/offers", offer);

export const createOffer = (offer) => api.post("/vendors/me/offers", offer);

export const getVendorOrders = () => api.get("/vendors/me/orders");

export const updateOrderStatus = (orderId, status, note) =>
  api.put(`/vendors/me/orders/${orderId}`, note ? { status, note } : { status });

export default api;
