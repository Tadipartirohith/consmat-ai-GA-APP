export const formatINR = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "₹ 0";
  return `₹ ${num.toLocaleString("en-IN")}`;
};

// Best-effort field pickers so UI stays resilient to schema variations.
export const pick = (obj, keys, fallback = undefined) => {
  if (!obj) return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
};

export const getOfferName = (o) =>
  pick(o, ["name", "title", "product_name", "item_name", "product"], "Untitled item");
export const getOfferPrice = (o) => pick(o, ["price", "unit_price", "amount", "cost"], 0);
export const getOfferStock = (o) =>
  pick(o, ["stock", "quantity", "qty", "available", "stock_count"], 0);
export const getOfferCategory = (o) => pick(o, ["category", "type", "group", "product_category"], "");
export const getOfferImage = (o) =>
  pick(o, ["image", "image_url", "photo", "thumbnail", "img", "picture"], "");
export const getOfferId = (o) => pick(o, ["id", "_id", "offer_id", "sku"], undefined);
