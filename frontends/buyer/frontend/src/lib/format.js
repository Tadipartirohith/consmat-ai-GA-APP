// Formatting helpers for INR currency and misc display values.

export function formatINR(value, { decimals = 0 } = {}) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) return "₹—";
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
