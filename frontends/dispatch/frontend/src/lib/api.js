import axios from "axios";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api/v1`;

export const TOKEN_KEY = "consmat_token";
export const USER_KEY = "consmat_user";

const client = axios.create({ baseURL: BASE });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const api = {
  login: (email, password) =>
    client.post("/auth/login", { email, password }).then((r) => r.data),
  dispatchQueue: () =>
    client.get("/operator/dispatch-queue").then((r) => r.data),
  dispatch: (orderId) =>
    client.post(`/operator/dispatch/${orderId}`).then((r) => r.data),
  deliver: (orderId, proof) =>
    client.post(`/operator/deliver/${orderId}`, proof || {}).then((r) => r.data),
  networkStock: () =>
    client.get("/operator/network-stock").then((r) => r.data),
  reorder: (payload) =>
    client.post("/operator/reorder", payload).then((r) => r.data),
  listViews: () => client.get("/operator/views").then((r) => r.data),
  createView: (payload) =>
    client.post("/operator/views", payload).then((r) => r.data),
  deleteView: (id) =>
    client.delete(`/operator/views/${id}`).then((r) => r.data),
};

// Low-stock thresholds by unit (used for alerts + badges)
const LOW_THRESHOLDS = {
  bags: 200,
  tonnes: 20,
  units: 20,
  kg: 100,
  pcs: 30000,
};

export const stockLevel = (product) => {
  const total = product.total_available ?? 0;
  if (total <= 0) return "out";
  const t = LOW_THRESHOLDS[product.unit] ?? 20;
  if (total <= t) return "low";
  return "ok";
};

export const formatINR = (n) => {
  const num = Number(n || 0);
  return `₹${num.toLocaleString("en-IN", {
    maximumFractionDigits: num % 1 === 0 ? 0 : 2,
  })}`;
};

export default client;
