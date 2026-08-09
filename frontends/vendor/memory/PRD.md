# VendorHub — Vendor Frontend (consumes external REST API)

## Original Problem Statement
Build a frontend that consumes an EXISTING REST backend at {API_BASE_URL} (OpenAPI at {API_BASE_URL}/openapi.json, prefix /api/v1). Do NOT build a backend. Auth is JWT bearer from POST /api/v1/auth/login ({access_token, user.role}). Dark theme, orange (#ff7a2f), panels #171c22 on #0f1216, star ratings, INR ₹, mobile-first. Demo password consmat123. Vendor app for role `vendor`: onboarding via POST /vendors/register; dashboard from GET /vendors/me (profile header + editable inventory table of offers[], each edit → PUT /vendors/me/offers, flag low_stock rows); incoming orders from GET /vendors/me/orders. Stock auto-decrements server-side.

## Architecture
- Frontend-only React app (CRA + craco). NO backend built (local FastAPI template untouched).
- Calls EXTERNAL backend at `{API_BASE_URL}/api/v1`. Base URL resolved from localStorage → `REACT_APP_API_BASE_URL` env, and is configurable at runtime via an in-app "API" dialog (since the URL is provided later).
- Axios instance (`src/lib/api.js`) with request interceptor injecting `baseURL` + `Authorization: Bearer <token>`.
- React Query for data fetching/caching; framer-motion for entrance animations; sonner for toasts.
- Resilient field pickers (`src/lib/format.js`) so UI tolerates schema variations until exact OpenAPI schema is confirmed.

## Endpoints consumed
- POST /auth/login → {access_token, user.role}
- POST /vendors/register (onboarding)
- GET /vendors/me (profile + offers[])
- PUT /vendors/me/offers (per-row offer edit)
- GET /vendors/me/orders (incoming orders)

## Implemented (2026-06)
- Login (JWT), Register/onboarding, protected routing, logout
- Dashboard: profile header (name, rating stars, location/phone/email), editable inventory table with inline price(₹)/stock editing, configurable low-stock threshold flagging, incoming orders list with status pills
- Add Product dialog (POST /vendors/me/offers), tap-through Order Details dialog, inventory search + low-stock filter
- Inline edit of product NAME + CATEGORY (in addition to price/stock) via PUT /vendors/me/offers
- Order Actions: Accept / Mark Fulfilled buttons in order detail → PUT /vendors/me/orders/{id} {status}
- Bulk Restock: one-tap dialog to set all low-stock items to a target stock level (loops PUT /vendors/me/offers)
- Order Status Timeline in details view (from status_history/history/events, with chronological fallback)
- Restock Presets: save a default restock level (localStorage) so bulk restock prefills instantly
- Category Filter dropdown on inventory (alongside search + low-stock filter)
- Sortable inventory columns (name / price / stock, asc-desc toggle on header tap)
- Timeline Notes: optional note sent with Accept/Fulfill (PUT /vendors/me/orders/{id} {status, note}); shown on the status timeline
- Sales Snapshot cards on dashboard: Orders Today + Revenue Today (with all-time subline), computed client-side from orders
- 7-day Revenue sparkline (recharts area chart) in the dashboard snapshot with week total
- Order Search: filter incoming orders by customer name or order id
- CSV Export: one-tap download of current inventory (name/category/price/stock) as a .csv
- Order Status Tabs: All / Pending / Accepted / Fulfilled quick filters with per-group counts
- Header Low-Stock Alert badge (count of items ≤ threshold), passed from Dashboard to Layout
- Revenue chart date-range toggle: 7 / 14 / 30 days with adaptive x-axis labels
- Header low-stock badge taps to open the bulk-restock dialog (window CustomEvent bridge)
- Top Products panel: best-sellers ranked by units sold + revenue, computed from order line items
- Friendly first-run empty states (inventory with inline Add CTA, orders guidance)
- Product Images: image URL per offer (add + inline edit), thumbnails in inventory & top-products
- Sales by Category: revenue split across categories with a stacked bar + legend (from order items, category resolved via offers)
- New-order notifications: orders polled every 30s; toast fires when order count increases while on dashboard
- Image Uploads: device photo upload with client-side resize/compress to a data URL (frontend-only, no backend); URL paste still supported. Stored as image_url on the offer
- Category donut: Sales by Category now a recharts donut with tap-to-highlight slices/legend and a center total
- Sound Alert: subtle WebAudio two-note chime plays with the new-order toast
- Exact palette #0f1216/#171c22/#ff7a2f, Manrope/IBM Plex fonts, mobile-first, full data-testid coverage
- Runtime API base URL config dialog

## Assumptions to confirm with real API
- PUT /vendors/me/offers body = single offer object `{...offer, id, name, category, price, stock}`. Adjust if it expects `{offers:[...]}`.
- Add offer = POST /vendors/me/offers. Order status update = PUT /vendors/me/orders/{id} with `{status}` (values "accepted"/"fulfilled").
- Registration fields inferred — align to OpenAPI once reachable.
- Low-stock threshold is a fixed, user-editable number (default 10).

## Pending / Blocked
- API_BASE_URL = http://localhost:3000 (user chose to keep). NOT reachable from cloud (in-container 3000 = frontend) and HTTPS→HTTP mixed content blocks it in the hosted preview. No end-to-end API testing performed; authenticated features (inline edit, add, order actions, bulk restock) compile clean but are unverified E2E.

## Backlog (P1/P2)
- P1: Verify/adjust offer PUT payload & registration fields against live OpenAPI schema
- P1: End-to-end testing once API URL + demo vendor email available
- P2: Add-new-offer flow, order detail view, search/filter inventory, pull-to-refresh
