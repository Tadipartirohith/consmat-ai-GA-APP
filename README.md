# Consmat AI, a construction materials marketplace

Consmat AI makes buying construction materials simple. A buyer types what they need in plain words, something like "everything for a 1500 sqft house in Medchal", and the app works out the exact materials and quantities, finds every vendor who can supply them, adds the real delivery cost from each vendor's warehouse to the buyer's site, and hands back a ranked list where the cheapest option that still meets a quality bar comes out on top. From there the buyer can acquire the whole list in a single tap.

This repository holds the complete, working platform. There is one backend and four apps, and you can bring all of it up with a single command.

## What you get

Four apps sit on top of one shared backend.

The Buyer app is for homebuilders, contractors and developers. They browse the catalog, chat with the AI, or estimate materials from a plan, then check out and track the order.

The Vendor app is for suppliers and manufacturers. They sign up, clear KYC, manage their prices and stock (which drops on its own whenever a sale happens), and watch orders come in.

The Admin app is the control room for Consmat HQ. It covers KYC approvals, GMV and analytics, vendor management, and the logistics pricing rules.

The Operator app is for the hub and spoke dispatch team. They fold several vendors' items into one delivery, send it out, keep an eye on stock across the network, and reorder when something runs low.

The part that really sets it apart is the buyer chat. Describe a whole project in one sentence and you get the full bill of materials, already priced, with a grand total and a one tap way to buy the lot.

## How it fits together

The browser only ever talks to one of the app addresses, for example http://localhost:8080 for the buyer. Each app is served by nginx, and when the app needs data, nginx quietly forwards those /api requests to the backend on the internal network. In other words, the browser talks to the app, and the app talks to the backend. You never have to tell the front end a separate backend address, and there is no cross origin setup to fuss with.

The backend does the real work: login and roles, the pricing and ranking engine, the estimator, the multi vendor optimizer, and the AI chat. The pricing math is deterministic, so the same request always gives the same answer. When you switch on a language model, it only reads and understands the sentence, and it never invents a price. Every number comes from the backend.

The backend keeps its data in memory, seeded from a single config file. Restarting it resets everything to a known state, which is handy for testing and demos. If you want lasting storage later, you can slot a database in behind the same interface without touching the rest.

## What is in the repo

```
ConsmatAI-app/
  START-HERE.bat, STOP.bat      Windows one click launcher and stop
  start.sh, stop.sh             the same for macOS and Linux
  docker-compose.yml            backend plus the four apps
  .env.example                  host ports, JWT secret, optional AI keys
  serve.py                      a no Docker static and proxy server, as a fallback
  backend/
    config.yaml                 all the data you might change, in one place
    requirements.txt, Dockerfile
    app/
      main.py                   the FastAPI app
      config.py, store.py       config loader and in memory store
      domain.py                 the pure pricing, ranking, estimator and optimizer math
      auth.py, serializers.py
      routers/                  common, buyer, vendor, admin, operator
  frontends/
    buyer, vendor, admin, dispatch
      frontend/build            the prebuilt site that nginx serves
      frontend/src              the React source, fixed and buildable
      Dockerfile, nginx.conf    nginx serves the site and forwards /api to the backend
```

The finished sites are committed on purpose, so the front end images are nginx only and "docker compose up" is really just copy the files and start nginx. That keeps startup fast, with no npm or webpack running inside Docker. If you want to rebuild from source, there is a short section on that below.

## Before you start

You need Docker Desktop on Windows or Mac, or Docker Engine with Compose v2 on Linux, installed and running. Around 2 GB of free disk and memory is plenty. That is the only requirement for the Docker route, and you do not need Node or Python on your machine.

## Running it

On Windows, the easy way is two steps. Start Docker Desktop and wait until it says running, then double click START-HERE.bat. It checks Docker, builds and starts everything, waits for the health check, prints the addresses, and opens the four apps in your browser. To stop, double click STOP.bat.

On any operating system, from a terminal, one line does it:

```bash
docker compose up -d --build
```

Then open the apps. The buyer is at http://localhost:8080, the vendor at http://localhost:8081, the admin at http://localhost:8082, and the operator at http://localhost:8083. The API and its Swagger docs are at http://localhost:3000/docs. Sign in with buyer@consmat.com, vendor@consmat.com, admin@consmat.com, or operator@consmat.in, and the password for every demo account is consmat123.

To stop, run docker compose down.

One thing worth remembering: the backend code is baked into its image, so after you pull new changes, bring it up with docker compose up -d --build so the new code is actually picked up.

## What the setup does, step by step

You do not have to run any of this by hand, the launchers handle it, but here is what happens under the hood.

The launcher, START-HERE.bat on Windows or start.sh on Mac and Linux, first checks that Docker is installed and running, and stops with a clear message if it is not. On the first run it creates a .env file from .env.example, which holds the host ports, the JWT secret, and the optional AI keys. It then runs docker compose up -d --build, which builds five images and starts them: the backend, a small Python service on port 3000, and the four apps, each an nginx server that serves the prebuilt site and forwards /api to the backend. Finally it waits until http://localhost:3000/health reports ok, and prints the addresses and demo logins.

If you would rather do it yourself, the equivalent commands are:

```bash
cp .env.example .env            # first run only
docker compose up -d --build    # build and start
docker compose logs -f backend  # watch the backend logs
docker compose restart backend  # apply a config.yaml change
docker compose down             # stop
```

## Everything you might change lives in one file

Open backend/config.yaml. That one file holds the warehouses, the delivery locations, the material catalog, the vendors with their prices and stock, the pricing engine settings, the logistics rules, the low stock thresholds, the demo accounts, how many demo orders to create on start, and the ports. Edit it, run docker compose restart backend, and the changes take effect. None of the business data is buried in the code.

The handful of infrastructure settings, meaning the host ports, the JWT secret, and the AI keys described below, live in .env.

## Configuration for the ops team (before testing or going live)

The app runs out of the box with safe local defaults, but before you point it at real vendors, take real payments, or put it on the internet, there are a few things to review. Most of the switches sit in backend/config.yaml under a clearly marked "GO-LIVE / OPS CONFIGURATION" block near the top of the file, and every secret value goes in .env. Here is what to change and where.

Endpoints and domains. For local runs the browser talks to each app on localhost and nginx forwards /api to the backend, so there is nothing to set. When you deploy behind real domains, you decide how the apps reach the backend. The simplest option is to keep the nginx forward and point it at your backend by editing the proxy target in each app's frontends/<app>/nginx.conf, the line that reads proxy_pass http://backend:3000. If instead you host the backend on its own domain, set deployment.public_api_url in config.yaml to that URL and rebuild the front ends with that address (see "Rebuilding the apps from source"). Either way, update deployment.frontend_urls to your real app addresses.

CORS. Local uses deployment.allowed_origins set to ["*"], which is fine for testing. Before going live, replace it with the exact front end domains, for example ["https://buyer.consmat.yourcompany.com", "https://admin.consmat.yourcompany.com"]. The backend applies this value on start, so a backend restart is all it takes.

Security. Change app.jwt_secret in config.yaml, or better, set JWT_SECRET in .env so it never lands in git. Change demo_password and remove or replace the demo_users before anyone outside the team can reach the app. If you want shorter sessions, lower access_token_ttl_min from its generous demo value.

Payment gateway. Out of the box payment is a stub, which means checkout records the order but does not charge anything. That is exactly what you want while testing. To take real money, set payments.provider in config.yaml to your gateway (razorpay, stripe, payu or cashfree), set payments.enabled to true and pick the currency, put the keys in .env (PAYMENT_KEY_ID, PAYMENT_KEY_SECRET, PAYMENT_WEBHOOK_SECRET), and wire the gateway call into the checkout handler in backend/app/routers/buyer.py. That handler is where the order is created, so it is the single place to add the charge and the webhook confirmation. Until you do this, treat every order as unpaid.

Real road distances. Delivery cost uses a straight line estimate by default, which is fine for a demo. For accurate road distances, set logistics_engine.provider to osrm in config.yaml and point OSRM_URL in .env at your OSRM service.

Notifications. Order and dispatch messages over WhatsApp or SMS are off by default. To turn them on, set notifications.provider and notifications.enabled in config.yaml, add the provider key to .env, and wire the adapter.

Persistence. The demo keeps everything in memory and resets when the backend restarts, which is deliberate so tests always start from a known state. Before production, set persistence.mode to postgres in config.yaml, point DATABASE_URL in .env at your database, and move the store to it behind the same interface. Nothing else in the app has to change, because the rest of the code only talks to the store, not the database directly.

Business data. Replace the sample warehouses, materials and vendors in config.yaml with your real catalog and suppliers, and set real prices, stock, and the pricing and logistics rules. It is the same file, so one edit and a backend restart puts your real data live.

A quick pre go live checklist: change the JWT secret, remove the demo accounts, lock down CORS, set your real domains, switch the payment provider on and wire it, move to a database, and load your real catalog and vendors. Once those are done, you are ready for a real test.

## The buyer chat, the heart of the app

Type the whole job in one message and the AI lists it and prices it. For example, "everything for a 1500 sqft 2 floor house in Medchal, on a budget" comes back as a full list of cement, TMT steel, river sand, aggregate and bricks, each with a vendor and a price, plus a grand total, and a one tap Add all to cart that buys the lot.

It understands whole project descriptions, picking up the area, the number of floors from phrases like "2 floor" or "G+1", the construction grade, and whether there are brick walls. It also handles explicit shopping lists like "50 bags cement, 3 t steel, 5000 bricks", the delivery town, and whether you care more about price or quality.

Turning on a real language model is optional. Out of the box the chat uses a built in parser, so it needs no key, costs nothing, and works with no internet at all. If you want a model to handle messier wording, set these in .env:

```
AI_PROVIDER=openai        # or anthropic
AI_API_KEY=your-key
AI_MODEL=gpt-4o-mini      # or for example claude-3-5-haiku-latest
```

then run docker compose up -d. Even with a model switched on, it only reads the sentence. Every price and stock figure still comes from the backend, so the answers stay honest.

## Rebuilding the apps from source

The finished sites are committed so the stack runs straight after cloning, with no Node toolchain needed. If you change front end code and want to rebuild one app:

```bash
cd frontends/buyer/frontend
npm install --legacy-peer-deps
CI=false REACT_APP_API_BASE_URL="" REACT_APP_BACKEND_URL="" npm run build
```

Do the same for the other apps, then run docker compose up -d --build. Leaving the API address blank makes the app call /api on its own address, which nginx forwards to the backend.

## The API in brief

The base address is http://localhost:3000/api/v1, with full docs at /docs. The main endpoints are:

Auth: POST /auth/login, GET /auth/me.

Buyer: GET /materials, POST /match, POST /estimate, POST /optimize, POST /ai/chat, POST /orders/checkout, GET /orders.

Vendor: POST /vendors/register, GET /vendors/me, POST and PUT /vendors/me/offers, GET /vendors/me/orders, PUT /vendors/me/orders/{id}.

Admin: GET /admin/metrics, GET /admin/orders, GET /admin/vendors, GET /admin/vendors/{id}, POST /admin/vendors/{id}/approve, POST /admin/vendors/bulk-approve, GET and PUT /admin/logistics-config.

Operator: GET /operator/dispatch-queue, POST /operator/dispatch/{id}, POST /operator/deliver/{id}, GET /operator/network-stock, POST /operator/reorder, and GET, POST and DELETE /operator/views.

## A note on the front end apps

The four apps were generated with Emergent, and they arrived with a couple of things that stopped a clean self hosted build. All of them are sorted out here. The private @emergentbase/visual-edits dependency, which returns a 403 outside Emergent and blocked npm install, has been removed, and the build copes gracefully without it. The ajv version that caused the "Cannot find module 'ajv/dist/compile/codegen'" crash on Create React App 5 is pinned to version 8. Each app was rebuilt with a relative API address so it works behind the nginx forward, with no hard coded backend URL. And the Docker images were trimmed down to nginx only, so bringing the stack up copies the finished site and starts nginx, instead of compiling React inside a container. The half finished backend folders that shipped inside the original Emergent repos are not used, because this repo's single backend already provides exactly what every app expects.

## If something goes wrong

If you see "Docker daemon is not running", start Docker Desktop, wait until it says running, and try again.

If a port is already taken, change it in .env, using BACKEND_PORT, BUYER_PORT, VENDOR_PORT, ADMIN_PORT or DISPATCH_PORT, and run docker compose up -d.

If the backend is healthy but an app shows API errors, check that the backend container is up with docker compose ps and healthy with curl http://localhost:3000/health.

If you changed config.yaml and nothing seems different, restart the backend with docker compose restart backend.

If you changed backend code and nothing seems different, rebuild with docker compose up -d --build.

## Built with

The backend is Python 3.11 with FastAPI and Uvicorn, using PyJWT and bcrypt for auth and PyYAML for config, keeping its data in memory. The apps are React, built with Create React App and CRACO, styled with Tailwind and Radix UI, and served by nginx. The whole thing runs on Docker and Docker Compose. A real language model from OpenAI or Anthropic is optional.

## License

MIT. See the LICENSE file.
