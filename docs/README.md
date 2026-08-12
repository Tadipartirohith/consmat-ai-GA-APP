# Consmat AI — Design Documentation

This folder contains the formal design documentation for the **Consmat AI** construction-materials
marketplace. The documents are written for engineers, reviewers, and operators, and all diagrams use
[Mermaid](https://mermaid.js.org/), which GitHub renders natively.

| Document | Scope | Audience |
|----------|-------|----------|
| [**HLD.md**](./HLD.md) — High-Level Design | System purpose, architecture, components, tech stack, actors, major modules, key data flows | Architects, new engineers, stakeholders |
| [**LLD.md**](./LLD.md) — Low-Level Design | Data models, full API reference, domain algorithms, the AI chat pipeline, auth, frontend internals, config reference | Implementers, code reviewers |
| [**SLD.md**](./SLD.md) — System-Level Design | Deployment landscape, containers, networking, environment config, external integrations, scaling & security | DevOps, operators, SRE |

## What is Consmat AI?

Consmat AI is a B2B marketplace for construction materials (cement, TMT steel, sand, aggregate, bricks)
delivered around Hyderabad. It connects **buyers** with multiple **vendors**, and provides an AI
procurement assistant, automatic bill-of-materials (BOM) estimation, stock-aware multi-vendor order
splitting, dispatch/logistics tracking, KYC/vendor management, complaints with escalation, and ratings
with moderation.

The platform is a **single FastAPI backend** serving **four React single-page apps** (buyer, vendor,
admin, operator/dispatch), packaged as five Docker containers behind per-app nginx.

## Core design principle: deterministic pricing

The AI assistant (optionally backed by a real LLM) only performs **natural-language understanding** —
extracting structure from a buyer's message and writing conversational replies. **Every price, stock
level, vendor allocation, and BOM quantity is computed by deterministic backend tools**, never by the
LLM. This keeps the marketplace auditable and trustworthy regardless of whether the LLM is enabled.

## Quick reference

- **Backend:** FastAPI (Python 3.11), in-memory store seeded from `backend/config.yaml`, API prefix `/api/v1`.
- **Frontends:** React 19 + CRA/CRACO + Tailwind + shadcn/ui, served as static sites via nginx.
- **AI layer:** pluggable provider (`stub | gemini | openai | groq | openrouter | anthropic | openai-compat`), currently Gemini free tier.
- **Auth:** JWT (HS256) bearer tokens, bcrypt password hashing, roles `buyer | vendor | operator | manager | admin`.
- **Deployment:** Docker Compose, 5 services, per-app nginx proxying `/api` to the shared backend.
