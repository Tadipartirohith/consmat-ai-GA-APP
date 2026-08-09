# ConsMat Admin Console — PRD

## Original Problem Statement
Build a frontend Admin web console that consumes a REST backend (prefix `/api/v1`). JWT bearer auth from `POST /api/v1/auth/login` → `{access_token, user.role}`. Dark theme, orange (#ff7a2f) accent, panels #171c22 on #0f1216, star ratings, INR ₹, mobile-first. Admin role only. Stat tiles from `GET /admin/metrics`. Vendor table from `GET /admin/vendors` with "Approve KYC" → `POST /admin/vendors/{id}/approve`. Recent orders from `GET /admin/orders`. Logistics-rules form bound to `GET/PUT /admin/logistics-config`.

## Architecture
- **Frontend**: React 19 + react-router + @tanstack/react-query + axios + framer-motion + Tailwind + shadcn/ui. Bearer token in localStorage (`consmat_token`), attached via axios interceptor. Base URL `${REACT_APP_BACKEND_URL}/api/v1`.
- **Backend (MOCKED)**: FastAPI on port 8001, routes under `/api/v1`. Implements the exact documented contract with real JWT (PyJWT + bcrypt) and MongoDB-seeded ConsMat data. This mock exists because the described external backend was not reachable in this environment; the frontend can be repointed to the real API by changing the base URL.

## User Personas
- **Marketplace Admin**: monitors GMV/orders, approves vendor KYC, reviews orders, tunes delivery/logistics rules.

## Core Requirements (static)
- JWT login (admin role), auth-guarded routes.
- Metrics tiles, vendor table + Approve KYC, recent orders, dynamic logistics-config form.
- Dark industrial theme, orange accent, star ratings, INR formatting, mobile-first responsive.

## Implemented (2026-06-19)
- Login page with demo helper; auth context + protected/public route guards; logout.
- Overview: 4 metric tiles (GMV compact INR, orders, active vendors, pending KYC) + recent orders snapshot + pending KYC list.
- Vendors: searchable dense table, star ratings, KYC badges, Approve KYC mutation (optimistic toast + query invalidation).
- Orders: searchable table with status filter chips, status badges, star ratings, INR amounts.
- Logistics: form dynamically rendered from API response (numbers/text/boolean toggles), Save (PUT) + Reset, dirty-state tracking.
- Responsive app shell: fixed sidebar (desktop) + slide-over drawer (mobile).
- Verified: backend 8/8 pytest, frontend 100% E2E (testing agent iteration_1).

## Implemented (2026-06-19, iteration 2)
- Vendor Profile drawer (click vendor row): business details, KYC documents with verified/pending status, order history, and an in-drawer "Approve KYC & Activate" action.
- Order Drilldown drawer (click order row): itemized line items + total, delivery timeline (with cancelled state), buyer contact card.
- CSV export on Vendors and Orders pages (one-click download).
- Backend: new `GET /admin/vendors/{id}` and `GET /admin/orders/{id}`; enriched seed data (documents, line_items, timeline, buyer contacts). Verified 14/14 pytest + 100% frontend E2E.

## Implemented (2026-06-19, iteration 3)
- Bulk KYC: multi-select pending vendors (row + select-all checkboxes) with a bulk action bar → `POST /admin/vendors/bulk-approve`.
- Date Filters: Overview period selector (all/7d/30d/this month) drives `GET /admin/metrics?start=`; Orders page range-calendar drives `GET /admin/orders?start=&end=`.
- Rating Insights: vendor drawer shows overall rating, 5→1 star breakdown bars, and recent buyer reviews. Pending vendors show zero breakdown.
- Printable Invoice: order drawer "Print Invoice" opens a styled invoice in a new window and auto-prints.
- Verified 21/21 pytest + 100% frontend E2E.

## Backlog
- **P2**: Popup-blocked toast for Print Invoice; date-range on GMV (end param) if needed.
- **P2**: Server-side pagination for large datasets; repoint to real external API (deferred per user).
