# Consmat Operator App — PRD

## Original Problem Statement
Build a frontend that consumes an EXISTING REST backend (OpenAPI, prefix `/api/v1`).
Do NOT build backend business logic — call the API and render responses.
Auth = JWT bearer from `POST /api/v1/auth/login` ({access_token, user.role}); send
`Authorization: Bearer <token>`. Dark theme, orange (#ff7a2f) accent, panels #171c22 on
#0f1216, star ratings, INR ₹, mobile-first. Demo password `consmat123`.
Build the **Operator app** (role `operator`): Dispatch queue from
`GET /operator/dispatch-queue` (consolidated multi-vendor tickets);
"Dispatch" → `POST /operator/dispatch/{order_id}`, "Delivered" →
`POST /operator/deliver/{order_id}`; Network stock from `GET /operator/network-stock`.
API_BASE_URL = http://localhost:3000.

## Environment Note
In this cloud environment, `localhost:3000` is the React frontend itself and is not a
browser-reachable backend. A **thin MOCK backend** (`/app/backend/server.py`) implements
the exact `/api/v1` contract (in-memory seed data) so the frontend is fully functional and
testable. The frontend is the real deliverable; swap `REACT_APP_BACKEND_URL` to point at the
real backend and it works unchanged.

## Architecture
- Frontend: React 19 + react-router 7 + Tailwind, axios client (`src/lib/api.js`) with
  bearer interceptor + 401 auto-logout. AuthContext stores token/user in localStorage.
- Design: "Tactical Operations Console" — Chivo (headers), IBM Plex Sans (body),
  JetBrains Mono (numbers/INR/IDs), sharp corners, 1px borders, no glassmorphism.
- Backend (MOCK): FastAPI, all routes under `/api/v1`, in-memory tokens + seed data.

## User Personas
- **Operator**: manages the consolidated dispatch queue and monitors network stock.

## Core Requirements (static)
- JWT bearer auth, role `operator`.
- Dispatch queue with consolidated multi-vendor tickets, star ratings, INR totals.
- Dispatch / Delivered lifecycle actions.
- Network stock across vendors with ratings + INR prices.
- Dark, orange-accent, mobile-first.

## Implemented (2026-06)
- Login screen with inline errors, demo hint, redirect guards.
- Operator dashboard: sticky nav, tab switch (Dispatch Queue / Network Stock), refresh, logout.
- Dispatch Queue: multi-vendor tickets grouped by vendor, vendor star ratings, per-vendor
  subtotals, INR order total, status badges, priority tags, status filters with counts.
- Dispatch + Delivered actions with optimistic status updates and toasts.
- Network Stock: expandable product rows, per-vendor stock/price/rating, OUT OF STOCK flags.
- Loading skeletons, error + retry states, empty states.
- Verified 100% by testing agent (backend contract + all UI flows).

## Implemented (2026-06 · iteration 2 & 3)
- Auto Refresh "LIVE" toggle with silent polling + interval picker (10s / 30s / 1m).
- Ticket Search (order id / customer) + Sort (newest / oldest / ₹ high / priority).
- Low Stock Alerts banner + per-product LOW/OUT badges.
- Reorder wired to REAL mock endpoint POST /api/v1/operator/reorder (restocks vendor,
  returns reorder id); product-level + per-vendor reorder with live stock refresh.
- Delivery ETA live countdown (MM:SS, flips to Overdue) on dispatched tickets;
  backend adds eta_minutes/eta_at on dispatch.
- Saved Views: pin/apply/delete search+filter+sort combos (localStorage), first view
  auto-applied on load.
- Verified 100% by testing agent (13/13 backend + all UI flows).

## Backlog / Remaining
- P1: Wire to the real backend (point REACT_APP_BACKEND_URL at it); remove demo password prefill.
- P2: Ticket search, auto-refresh/polling, per-vendor dispatch, delivery ETA.
- P2: Low-stock alerts / reorder shortcuts from Network Stock.

## Next Tasks
- Connect real backend + role-based routing for other roles if needed.
