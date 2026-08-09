// Shared order-status helpers used by AppContext (global polling) and OrdersSheet.

export const g = (o, keys, fb) => {
  for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
  return fb;
};

export const STATUS_STEPS = [
  { key: "placed", label: "Placed", match: ["placed", "confirmed", "pending", "processing", "ordered"] },
  { key: "dispatched", label: "Dispatched", match: ["dispatched", "shipped", "out_for_delivery", "in_transit", "transit"] },
  { key: "delivered", label: "Delivered", match: ["delivered", "completed", "fulfilled", "received"] },
];

export function statusBucket(order) {
  const s = String(g(order, ["status", "state"], "placed")).toLowerCase();
  if (s.includes("cancel")) return "cancelled";
  let bucket = "placed";
  STATUS_STEPS.forEach((step) => {
    if (step.match.some((m) => s.includes(m))) bucket = step.key;
  });
  return bucket;
}

export const orderId = (o) => String(g(o, ["order_id", "id", "orderId"], ""));

export function normalizeOrders(data) {
  return Array.isArray(data) ? data : data?.orders || data?.items || [];
}

export function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STEP_DATE_FIELDS = {
  placed: ["placed_at", "ordered_at", "created_at", "order_date", "placed_date"],
  dispatched: ["dispatched_at", "shipped_at", "dispatch_date", "ship_date", "dispatched_date"],
  delivered: ["delivered_at", "delivery_date", "delivered_date", "eta", "expected_delivery", "delivery_eta"],
};

export function getStepDate(order, stepKey, matches) {
  const tl = g(order, ["timeline", "tracking", "history", "events"], null);
  if (Array.isArray(tl)) {
    const hit = tl.find((e) => {
      const s = String(g(e, ["status", "step", "state", "name"], "")).toLowerCase();
      return matches.some((m) => s.includes(m));
    });
    if (hit) return fmtDate(g(hit, ["date", "timestamp", "at", "time", "on"], null));
  }
  return fmtDate(g(order, STEP_DATE_FIELDS[stepKey] || [], null));
}
