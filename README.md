# Consmat AI — Construction-Materials Marketplace (Full Platform)

An AI procurement matchmaker for construction materials, built for the
**SVR Group / S3 Datacom** "Consmat AI" concept. A buyer describes what they
need in plain language; the platform converts it into a precise material spec,
finds every vendor who can supply it, adds the real delivery cost from each
vendor's warehouse to the buyer's site, and returns a ranked list where **the
cheapest option that still clears a quality bar wins** — then lets the buyer
**acquire the whole bill of materials in one shot**.

This repository contains the **entire working platform**: one backend API plus
four role-based front-ends, wired together and runnable with a single command.

---

## 1. What's inside

Four role-specific apps over **one shared backend**:

| App | Who uses it | What it does |
|---|---|---|
| 🛒 **Buyer** | Homebuilders, contractors, developers | Shop the catalog, **chat with the AI** ("everything for a 1500 sqft house in Medchal"), or estimate from a plan → cart → pay → track. |
| 🏭 **Vendor** | Suppliers / traders / manufacturers | Onboarding + KYC, manage price & stock (auto-decrements on sale), see incoming orders. |
| 🛡️ **Admin** | Consmat HQ | KYC approvals, GMV/analytics, vendor management, logistics-rule config. |
| 🚚 **Operator** | Hub & spoke dispatch staff | Consolidate multi-vendor orders into one delivery, dispatch, track network stock, reorder. |

The heart of the product is the **AI single-shot buyer flow**: describe a whole
project in one message and get the complete, priced bill of materials with a
grand total and a one-tap **"acquire everything"** action.

---

## 2. Architecture

```
  Browser
    │  (each app is its own origin, e.g. http://localhost:8080)
    ▼
┌─────────────────────────────────────────────┐
│  nginx (per front-end container)             │
│   • serves the prebuilt React SPA            │
│   • proxies  /api/*  ──────────────┐         │
└────────────────────────────────────┼─────────┘
                                     ▼
                        ┌──────────────────────────┐
                        │  backend (FastAPI)        │
                        │   • auth (JWT, roles)     │
                        │   • pricing/ranking engine│  ◄── pure, deterministic
                        │   • estimator + optimizer │
                        │   • AI chat (LLM-pluggable)│
                        │   • in-memory store       │  ◄── seeded from config.yaml
                        └──────────────────────────┘
```

- **Same-origin by design.** The browser only talks to a front-end origin;
  that app's nginx proxies `/api` to the backend on the internal Docker network.
  No CORS, and **no API URL to configure**.
- **Deterministic value engine.** Ranking, landed-cost, estimator and the
  multi-vendor optimizer are pure functions — auditable and identical every run.
  The LLM only *understands* language; it never invents prices.
- **In-memory store seeded from `config.yaml`.** Restarting the backend resets
  to a known, repeatable state — ideal for testing/demos. Swap in a database
  later behind the same store interface for persistence.

---

## 3. Repository layout

```
ConsmatAI-app/
├─ START-HERE.bat / STOP.bat      # Windows one-click launcher / stop
├─ start.sh / stop.sh             # macOS / Linux launcher / stop
├─ docker-compose.yml             # backend + 4 front-ends
├─ .env.example                   # host ports, JWT secret, AI keys
├─ serve.py                       # no-Docker static+proxy server (fallback)
├─ backend/
│  ├─ config.yaml                 # ALL variable data (edit here)
│  ├─ requirements.txt  Dockerfile
│  └─ app/
│     ├─ main.py                  # FastAPI app
│     ├─ config.py store.py       # config loader + in-memory store
│     ├─ domain.py                # pure pricing / ranking / estimator / optimizer
│     ├─ auth.py serializers.py
│     └─ routers/                 # common, buyer, vendor, admin, operator
└─ frontends/
   ├─ buyer/ vendor/ admin/ dispatch/
   │   ├─ frontend/build/         # PREBUILT static site (served by nginx)
   │   ├─ frontend/src ...        # React source (fixed & buildable)
   │   ├─ Dockerfile  nginx.conf  # nginx: serve SPA + proxy /api -> backend
```

> **Why builds are committed:** the front-end images are nginx-only and serve
> `frontend/build`, so `docker compose up` is just "copy files + start nginx" —
> fast, no npm/webpack in Docker. To rebuild from source, see §9.

---

## 4. Prerequisites

- **Docker Desktop** (Windows/macOS) or Docker Engine + Compose v2 (Linux),
  installed and **running**.
- ~2 GB free disk and RAM for the containers. That's it — no Node or Python
  needed on the host for the Docker path.

---

## 5. Quick start

### Windows — one click
1. Make sure **Docker Desktop is running**.
2. Double-click **`START-HERE.bat`**.

It checks Docker, builds + starts everything, waits for the health check, prints
the URLs, and opens all four apps in your browser. Stop with **`STOP.bat`**.

### Any OS — command line
```bash
docker compose up -d --build
```

Then open:

| App | URL | Login (password `consmat123`) |
|---|---|---|
| 🛒 Buyer | http://localhost:8080 | `buyer@consmat.com` |
| 🏭 Vendor | http://localhost:8081 | `vendor@consmat.com` |
| 🛡️ Admin | http://localhost:8082 | `admin@consmat.com` |
| 🚚 Operator | http://localhost:8083 | `operator@consmat.in` |
| ⚙️ API + Swagger | http://localhost:3000/docs | — |

Stop: `docker compose down`.

> The `--build` flag matters: the backend code is baked into its image, so after
> pulling changes always run `docker compose up -d --build`.

---

## 6. Infrastructure setup — what the scripts do

You don't have to run these by hand (the launchers do), but here's exactly what
happens, step by step:

**`START-HERE.bat`** (Windows) / **`start.sh`** (macOS/Linux):
1. Verify Docker is installed and the daemon is running; bail out with a clear
   message if not.
2. Create `.env` from `.env.example` on first run (host ports, JWT secret, AI keys).
3. `docker compose up -d --build` — builds five images and starts the stack:
   - `backend` → `pip install` + `uvicorn` on port 3000.
   - `buyer/vendor/admin/dispatch` → nginx serving the prebuilt SPA + proxying `/api`.
4. Poll `http://localhost:3000/health` until it returns `{"status":"ok"}`.
5. Print the URLs + demo logins (Windows also opens the apps in the browser).

**`docker-compose.yml`** wires it together: the backend publishes `:3000`; each
front-end publishes its port (`8080–8083`) and `depends_on` the backend. Because
nginx proxies `/api` to the `backend` service name on the internal network,
there is no cross-origin config and the apps work identically on localhost or a
LAN IP.

Manual equivalents:
```bash
cp .env.example .env             # first run only
docker compose up -d --build     # build + start
docker compose logs -f backend   # watch logs
docker compose restart backend   # apply a config.yaml change
docker compose down              # stop (add -v is not needed; state is in-memory)
```

---

## 7. Configuration — everything variable is in one file

**`backend/config.yaml`** is the single source of all tweakable data:

- **Warehouses** (Consmat hub + Hyderabad spokes, with lat/lng)
- **Delivery locations** (buyer sites)
- **Material catalog** (name, category, unit, grade, thumb-rule per-sqft, image)
- **Vendors** — tier, quality rating, ISI flag, credit terms, city, GST, serving
  warehouse, KYC state, and per-material **price + stock**
- **Pricing engine** — `rate_per_km`, `handling`, `quality_gate`, per-material
  `load_factor`
- **Logistics rules** shown on the Admin screen (editable at runtime too)
- **Low-stock thresholds** by unit
- **Demo accounts** and how many demo orders to seed on boot
- **Ports** (reference)

Edit it, then `docker compose restart backend` to apply. Nothing business-related
is hard-coded in the app.

Infra-only knobs live in **`.env`** (host ports, `JWT_SECRET`, and the AI keys
below).

---

## 8. The AI "single-shot" buyer flow

Describe the whole job in one message; the AI lists **and** prices everything,
and returns a one-tap "acquire all" payload.

Example (real output):

> **You:** "everything for a 1500 sqft 2-floor house in Medchal, on a budget"
> **Consmat AI:** For a **3,000 sq ft standard build (2 floors)**, here's
> everything you need — each from its cheapest reliable vendor, delivery included:
> • Cement: 1200 bags — Sri Balaji Traders (₹468,746)
> • TMT Steel: 12.0 tonnes — UltraBuild Wholesale (₹768,115)
> • River Sand: 244.8 tonnes — Godavari Sand Co. (₹269,058)
> • Aggregate 20mm: 171.0 tonnes — Metro Steel & Cement (₹171,646)
> • Bricks: 24,000 pcs — Kakatiya Bricks Mfg. (₹176,413)
> **Grand total: ₹1,853,978 delivered. Tap "Add all to cart" to acquire it all.**

It understands: whole-project descriptions (area, floors incl. "2-floor" / "G+1",
construction grade, brick/no-brick), explicit item lists ("50 bags cement, 3 t
steel, 5000 bricks"), location, and cheap-vs-quality intent.

### Enable a real LLM (optional)
By default the AI uses a **deterministic parser** — no key, no cost, fully
offline. To use a real model for messier language, set these in `.env`:

```
AI_PROVIDER=openai        # or: anthropic
AI_API_KEY=sk-...         # your key
AI_MODEL=gpt-4o-mini      # or e.g. claude-3-5-haiku-latest
```
then `docker compose up -d`. The LLM only extracts structure from the message;
**all prices/stock still come from the backend**, so results stay trustworthy.

---

## 9. Rebuilding the front-ends from source

The committed `frontend/build` dirs let the stack run without a Node toolchain.
To change front-end code and rebuild:

```bash
cd frontends/buyer/frontend
npm install --legacy-peer-deps
CI=false REACT_APP_API_BASE_URL="" REACT_APP_BACKEND_URL="" npm run build
```
(Repeat per app.) The empty API base makes the app call `/api` on its own origin,
which nginx proxies to the backend. Then `docker compose up -d --build`.

---

## 10. API overview

Base: `http://localhost:3000/api/v1` (full Swagger at `/docs`). Highlights:

- **Auth:** `POST /auth/login`, `GET /auth/me`
- **Buyer:** `GET /materials`, `POST /match`, `POST /estimate`, `POST /optimize`,
  `POST /ai/chat`, `POST /orders/checkout`, `GET /orders`
- **Vendor:** `POST /vendors/register`, `GET /vendors/me`,
  `POST|PUT /vendors/me/offers`, `GET /vendors/me/orders`,
  `PUT /vendors/me/orders/{id}`
- **Admin:** `GET /admin/metrics`, `GET /admin/orders`, `GET /admin/vendors`,
  `GET /admin/vendors/{id}`, `POST /admin/vendors/{id}/approve`,
  `POST /admin/vendors/bulk-approve`, `GET|PUT /admin/logistics-config`
- **Operator:** `GET /operator/dispatch-queue`, `POST /operator/dispatch/{id}`,
  `POST /operator/deliver/{id}`, `GET /operator/network-stock`,
  `POST /operator/reorder`, `GET|POST|DELETE /operator/views`

---

## 11. Fixes applied to the Emergent front-ends

The four apps were generated with Emergent and shipped with a few issues that
blocked a clean, self-hosted build. All are fixed here:

1. Removed the private `@emergentbase/visual-edits` dependency (hosted on
   Emergent's servers, 403 elsewhere) — it blocked `npm install`.
2. Pinned `ajv@8` to fix the CRA5 `Cannot find module 'ajv/dist/compile/codegen'`
   build crash.
3. Prebuilt each app with a **relative** API base so it works behind the nginx
   proxy (no hard-coded backend URL).
4. Reshaped the Docker images to **nginx-only** (serve prebuilt static + proxy
   `/api`) so `docker compose up` never runs npm/webpack in a container.

The unfinished `backend/` folders inside the original Emergent repos are **not
used** — this repo's single `backend/` implements the exact API every front-end
expects.

---

## 12. Troubleshooting

- **"Docker daemon is not running"** — start Docker Desktop, wait until it says
  *Running*, re-run.
- **Port already in use** — change the port in `.env`
  (`BACKEND_PORT`/`BUYER_PORT`/`VENDOR_PORT`/`ADMIN_PORT`/`DISPATCH_PORT`) and
  `docker compose up -d`.
- **Backend healthy but an app shows API errors** — the app calls `/api` on its
  own origin; make sure the `backend` container is up (`docker compose ps`) and
  healthy (`curl http://localhost:3000/health`).
- **Changed `config.yaml` but no effect** — `docker compose restart backend`.
- **Changed backend code but no effect** — rebuild: `docker compose up -d --build`.

---

## 13. Tech stack

- **Backend:** Python 3.11, FastAPI, Uvicorn, PyJWT, bcrypt, PyYAML (in-memory store).
- **Front-ends:** React (CRA + CRACO), Tailwind, Radix UI, served by nginx.
- **Infra:** Docker + Docker Compose. Optional real LLM via OpenAI/Anthropic.

---

## 14. License

MIT — see `LICENSE`.
