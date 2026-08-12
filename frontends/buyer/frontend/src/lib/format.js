// Formatting helpers for INR currency and misc display values.

export function formatINR(value, { decimals = 0 } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "₹0";
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  );
}

export function formatNumber(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-IN");
}

// Normalise a quality value that may arrive as 0-5, 0-10 or 0-100.
export function toStars(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  if (n <= 5) return n;
  if (n <= 10) return n / 2;
  return (n / 100) * 5;
}

export function titleCase(str = "") {
  return String(str)
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- Cart pricing ----------------------------------------------------------
// A cart item stores a per-unit material price plus a fixed delivery (logistics)
// cost, so its landed total recomputes correctly whenever the quantity changes.
// Legacy items only carried `price` (the landed total for the original quantity);
// for those we back out an approximate unit price so editing still behaves.
export function cartUnitPrice(item = {}) {
  if (item.unit_price !== undefined && item.unit_price !== null) return Number(item.unit_price) || 0;
  const q = Number(item.quantity) || 0;
  const p = Number(item.price) || 0;
  return q ? p / q : p;
}

export function cartLineTotal(item = {}) {
  const q = Number(item.quantity) || 0;
  return cartUnitPrice(item) * q + (Number(item.logistics) || 0);
}

export function cartGrandTotal(cart = []) {
  return cart.reduce((sum, it) => sum + cartLineTotal(it), 0);
}
