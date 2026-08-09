# Consmat AI — Buyer App PRD

## Original Problem Statement
Build a **frontend only** that consumes an EXISTING REST backend at `{API_BASE_URL}` (OpenAPI at `{API_BASE_URL}/openapi.json`, prefix `/api/v1`). Do NOT build a backend or business logic — call the API and render responses. JWT bearer auth from `POST /api/v1/auth/login` ({access_token, user.role}); send `Authorization: Bearer <token>`. Dark theme, orange (#ff7a2f) accent, panels #171c22 on #0f1216, star ratings, INR ₹, mobile-first. Demo password `consmat123`.

Buyer app: Home with three modes — Shop, Chat, Estimate. Cart optimize + checkout, order history. Header with location picker and Cheapest↔Best-quality slider (0–100) feeding `price_quality`.

## User Choices
- API base URL: not ready → placeholder, swappable via `REACT_APP_API_BASE_URL`
- Demo login default: `buyer@consmat.com` / `consmat123`
- Token storage: localStorage
- Brand: Consmat AI
- Full login screen (no auto-login)

## Architecture
- **Frontend**: React 19 + CRA/craco, Tailwind, shadcn/ui, sonner, lucide-react, axios.
- **State**: `AppContext` (token, user, location, priceQuality, cart) — React Context.
- **API client**: `src/lib/api.js` — axios instance, base `${REACT_APP_API_BASE_URL}/api/v1`, Bearer interceptor, 401 → logout+redirect.
- **No backend/business logic** written (per requirement). Renders whatever the API returns, with defensive field-name mapping.

## Implemented (2026-06-08)
- **Login** (`/login`): JWT via `POST /api/v1/auth/login`, stores token+user in localStorage, industrial visual split-screen.
- **Header**: brand, location picker (ibrahimpatnam, medchal, sangareddy, bhongir, ghatkesar, hyderabad), Cheapest↔Best-quality range slider (0–100), cart button w/ badge, orders button, logout.
- **Shop mode**: `GET /materials` grid → select material → `POST /match {material,quantity,location,price_quality}` → vendor cards (landed price, material+logistics breakdown, quality stars, warehouse+distance, "why", add-to-cart).
- **Chat mode**: `POST /ai/chat` → renders reply, suggestion chips (clickable), ranked vendor cards, "Add all to cart".
- **Estimate mode**: `POST /estimate` → BOM table (material/qty/unit/cost) → "Add all to cart" + total.
- **Cart** (sheet): line-item qty edit/remove, `POST /optimize` → split-vs-single sourcing plans + savings badge + recommended.
- **Checkout modal**: UPI / Card / Credit, `POST /orders/checkout`, success state with order id.
- **Orders** (sheet): `GET /orders` history list.
- INR ₹ formatting (Indian grouping), star ratings (normalizes 0-5 / 0-10 / 0-100), mobile-first grids, data-testid on all interactive elements.

## Known Limitations
- External backend not yet connected (placeholder URL) → all `/api/v1/*` calls currently 404; UI shows graceful empty/error states. Swap `REACT_APP_API_BASE_URL` and restart to go live.
- End-to-end flows (login, match, chat, estimate, optimize, checkout, orders) NOT verified against a live API — no backend available to test against yet.

## Backlog / Next
- P0: Wire real API base URL and verify each endpoint's response shape vs. defensive mappings in `VendorCard`, `ShopMode`, `CartSheet`, `EstimateMode`, `OrdersSheet`.
- P1: Material thumbnails from API images; persistent cart across refresh.
- P2: Seller/admin role views; order detail drill-down.
