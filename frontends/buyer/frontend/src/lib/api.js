import axios from "axios";

// The frontend consumes an EXISTING backend. Base URL is swappable via env.
const BASE =
  process.env.REACT_APP_API_BASE_URL || process.env.REACT_APP_BACKEND_URL || "";
export const API_ROOT = `${BASE.replace(/\/$/, "")}/api/v1`;

export const TOKEN_KEY = "consmat_token";
export const USER_KEY = "consmat_user";

const client = axios.create({ baseURL: API_ROOT });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ---- Auth ----
export async function login(email, password) {
  const { data } = await client.post("/auth/login", { email, password });
  return data; // { access_token, user: { role, ... } }
}

// ---- Shop ----
export async function getMaterials() {
  const { data } = await client.get("/materials");
  return data;
}

export async function match(payload) {
  // { material, quantity, location, price_quality }
  const { data } = await client.post("/match", payload);
  return data;
}

// ---- Chat ----
export async function aiChat(payload) {
  // { message, location, price_quality, history? }
  const { data } = await client.post("/ai/chat", payload);
  return data; // { reply, chips, cards, suggestions }
}

// ---- Estimate ----
export async function estimate(payload) {
  const { data } = await client.post("/estimate", payload);
  return data; // { items: [...] }
}

// ---- Cart optimize ----
export async function optimize(payload) {
  const { data } = await client.post("/optimize", payload);
  return data; // { split, single, savings, recommended }
}

// ---- Orders ----
export async function checkout(payload) {
  const { data } = await client.post("/orders/checkout", payload);
  return data;
}

export async function getOrders() {
  const { data } = await client.get("/orders");
  return data;
}

// ---- Live delivery tracking ----
export async function getTracking(orderId) {
  const { data } = await client.get(`/orders/${orderId}/tracking`);
  return data; // { origin, dest, vehicle, progress, distance_km, remaining_km, eta_at, driver, ... }
}

// ---- Customer support / complaints ----
export async function raiseComplaint(payload) {
  const { data } = await client.post("/support/complaints", payload);
  return data;
}
export async function getComplaints() {
  const { data } = await client.get("/support/complaints");
  return data; // { complaints: [...] }
}
export async function getComplaint(id) {
  const { data } = await client.get(`/support/complaints/${id}`);
  return data;
}
export async function addComplaintMessage(id, note) {
  const { data } = await client.post(`/support/complaints/${id}/messages`, { note });
  return data;
}

export default client;
