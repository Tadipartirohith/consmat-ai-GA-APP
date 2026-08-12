"""Consmat AI — unified backend for all four frontends
(buyer / vendor / admin / operator). Single process, in-memory store seeded
from config.yaml. Serves the exact API shapes each frontend consumes."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import cfg
from .routers import common, buyer, vendor, admin, operator, support, ratings

logging.basicConfig(level=logging.INFO)

_c = cfg()
PREFIX = _c["app"]["api_prefix"]

app = FastAPI(title="Consmat AI — Unified API", version="1.0.0")

# CORS: ops team locks this down for production via config.yaml -> deployment.allowed_origins
_allowed_origins = (_c.get("deployment") or {}).get("allowed_origins") or ["*"]
app.add_middleware(CORSMiddleware, allow_origins=_allowed_origins, allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=False)

for r in (common.router, buyer.router, vendor.router, admin.router, operator.router,
          support.router, ratings.router):
    app.include_router(r, prefix=PREFIX)


@app.get("/health")
def health():
    return {"status": "ok", "service": _c["app"]["name"]}


@app.get("/")
def root():
    return {"service": _c["app"]["name"], "docs": "/docs", "api_prefix": PREFIX}
