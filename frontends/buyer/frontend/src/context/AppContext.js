import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { TOKEN_KEY, USER_KEY, getOrders } from "@/lib/api";
import { statusBucket, orderId, normalizeOrders } from "@/lib/orderStatus";
import { playChime } from "@/lib/chime";
import { toast } from "sonner";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export const LOCATIONS = [
  "ibrahimpatnam",
  "medchal",
  "sangareddy",
  "bhongir",
  "ghatkesar",
  "hyderabad",
];

const CART_KEY = "consmat_cart";

export function AppProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });
  const [location, setLocation] = useState("hyderabad");
  const [priceQuality, setPriceQuality] = useState(50); // 0 cheapest -> 100 best quality
  const [cart, setCart] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  }); // [{ id, material, quantity, unit, vendor, price }]

  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  // ---- Global orders state + polling for app-wide alerts ----
  const [orders, setOrders] = useState(null);
  const [ordersError, setOrdersError] = useState(null);
  const [ordersMoved, setOrdersMoved] = useState(false);
  const [orderUpdate, setOrderUpdate] = useState({ id: null, at: 0 });
  const [alerts, setAlerts] = useState([]);
  const [unseenAlerts, setUnseenAlerts] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("consmat_sound") !== "off"
  );
  const soundRef = useRef(soundEnabled);
  const prevBuckets = useRef({});

  useEffect(() => {
    soundRef.current = soundEnabled;
    localStorage.setItem("consmat_sound", soundEnabled ? "on" : "off");
  }, [soundEnabled]);

  const toggleSound = useCallback(() => setSoundEnabled((s) => !s), []);
  const markAlertsSeen = useCallback(() => setUnseenAlerts(0), []);
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setUnseenAlerts(0);
  }, []);
  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setUnseenAlerts((n) => Math.max(0, n - 1));
  }, []);
  const restoreAlert = useCallback((alert) => {
    setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)].sort((a, b) => b.at - a.at).slice(0, 20));
  }, []);
  const [focusOrderId, setFocusOrderId] = useState(null);
  const requestPush = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const applyOrders = useCallback((list) => {
    setOrders(list);
    const prev = prevBuckets.current;
    const isFirst = Object.keys(prev).length === 0;
    let moved = false;
    list.forEach((o) => {
      const id = orderId(o);
      const b = statusBucket(o);
      if (!isFirst && prev[id] && prev[id] !== b) {
        moved = true;
        setOrderUpdate({ id, at: Date.now() });
        const message =
          b === "dispatched"
            ? `Order #${id} has been dispatched`
            : b === "delivered"
            ? `Order #${id} has been delivered`
            : `Order #${id} is now ${b}`;
        setAlerts((prevA) =>
          [{ id: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, orderId: id, bucket: b, at: Date.now(), message }, ...prevA].slice(0, 20)
        );
        setUnseenAlerts((n) => n + 1);
        if (b === "dispatched") {
          toast(message, { icon: "🚚" });
        } else if (b === "delivered") {
          toast.success(message);
          if (soundRef.current) playChime();
        }
        // Background browser push when tab is hidden.
        if (
          (b === "dispatched" || b === "delivered") &&
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.hidden
        ) {
          try {
            new Notification("Consmat AI", { body: message });
          } catch {
            /* ignore */
          }
        }
      }
      prev[id] = b;
    });
    if (moved) setOrdersMoved(true);
  }, []);

  const refreshOrders = useCallback(async () => {
    try {
      const list = normalizeOrders(await getOrders());
      applyOrders(list);
      setOrdersError(null);
      return list;
    } catch (e) {
      setOrdersError(e?.message || "Failed to load orders");
      return null;
    }
  }, [applyOrders]);

  const markOrdersSeen = useCallback(() => setOrdersMoved(false), []);

  useEffect(() => {
    if (!token) {
      prevBuckets.current = {};
      setOrders(null);
      return;
    }
    refreshOrders();
    const iv = setInterval(refreshOrders, 8000);
    return () => clearInterval(iv);
  }, [token, refreshOrders]);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  const authenticate = useCallback((data) => {
    const t = data.access_token;
    const u = data.user || null;
    localStorage.setItem(TOKEN_KEY, t);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const addToCart = useCallback((item) => {
    setCart((prev) => {
      // Key by material + vendor + brand so the same material from two vendors
      // (or two brands from one vendor) stays as separate lines.
      const mkey = (item.material || item.name || "").toLowerCase();
      const vkey = (item.vendor || "").toLowerCase();
      const bkey = (item.brand || "").toLowerCase();
      const idx = prev.findIndex(
        (p) =>
          (p.material || "").toLowerCase() === mkey &&
          (p.vendor || "").toLowerCase() === vkey &&
          (p.brand || "").toLowerCase() === bkey
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: Number(next[idx].quantity || 0) + Number(item.quantity || 1),
          unit_price: item.unit_price ?? next[idx].unit_price,
          logistics: item.logistics ?? next[idx].logistics,
        };
        return next;
      }
      return [
        ...prev,
        {
          id: `${mkey}-${vkey}-${bkey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          material: item.material || item.name,
          quantity: Number(item.quantity || 1),
          unit: item.unit || "units",
          vendor: item.vendor || null,
          vendor_id: item.vendor_id || null,
          brand: item.brand || "",
          offer_key: item.offer_key || null,
          price: item.price ?? item.landed_price ?? null,
          // Per-unit price + fixed delivery so the line total recomputes on qty change.
          unit_price: item.unit_price ?? null,
          logistics: item.logistics ?? 0,
        },
      ];
    });
  }, []);

  const addManyToCart = useCallback(
    (items = []) => {
      items.forEach((it) => addToCart(it));
      toast.success(`Added ${items.length} item(s) to cart`);
    },
    [addToCart]
  );

  const updateCartItem = useCallback((id, patch) => {
    setCart((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removeCartItem = useCallback((id) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  return (
    <AppContext.Provider
      value={{
        token,
        user,
        authenticate,
        logout,
        location,
        setLocation,
        priceQuality,
        setPriceQuality,
        cart,
        addToCart,
        addManyToCart,
        updateCartItem,
        removeCartItem,
        clearCart,
        cartOpen,
        setCartOpen,
        ordersOpen,
        setOrdersOpen,
        orders,
        ordersError,
        refreshOrders,
        ordersMoved,
        markOrdersSeen,
        orderUpdate,
        alerts,
        unseenAlerts,
        markAlertsSeen,
        clearAlerts,
        dismissAlert,
        restoreAlert,
        focusOrderId,
        setFocusOrderId,
        soundEnabled,
        toggleSound,
        requestPush,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
