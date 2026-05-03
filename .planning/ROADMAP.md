# KLARY — Project Roadmap

> Status key: ✅ Complete · 🟡 Partial · ❌ Not started

---

## Phase 1 — Foundation & Infrastructure
**Status: ✅ Complete**

Core server setup, security hardening, and database schema.

### Deliverables
- [x] Express + TypeScript server (`backend/src/server.ts`)
- [x] PostgreSQL + Prisma ORM with full schema (`backend/prisma/schema.prisma`)
- [x] Helmet security headers (CSP, HSTS, etc.)
- [x] CORS with origin allowlist
- [x] Rate limiting (global 100req/15min + auth 10req/15min)
- [x] Morgan request logging with Winston logger
- [x] Global error handler middleware
- [x] Request validator middleware
- [x] Docker + Docker Compose setup (`docker/`)
- [x] Environment variable structure (`.env.example`)
- [x] Health check endpoint (`GET /health`)

---

## Phase 2 — Auth & Multi-Tenancy
**Status: ✅ Complete**

JWT auth, role-based access, multi-org support.

### Deliverables
- [x] User registration + login with bcrypt password hashing
- [x] JWT access tokens (short-lived) + refresh tokens
- [x] Role-based access control: ADMIN / MANAGER / USER / VIEWER
- [x] `authenticate` middleware for protected routes
- [x] `requireRole` middleware for admin endpoints
- [x] Account lockout after failed login attempts
- [x] MFA secret storage (model ready, flow not UI-exposed)
- [x] Multi-tenant Organisation model with subscription tiers
- [x] Auth rate limiter (10 attempts / 15 min)
- [x] User management routes (`/api/v1/users`)

---

## Phase 3 — Client Management
**Status: ✅ Complete**

Full client CRUD with classification and advisory tracking.

### Deliverables
- [x] Client model (name, org number, industry, size, status)
- [x] Client CRUD routes (`/api/v1/clients`)
- [x] Advisory debt + billing totals per client
- [x] ClientActivity model for tracking client communications
- [x] `adviceDebt` / `totalBilled` aggregation fields
- [x] Frontend: `ClientsPage.tsx` — list, create, edit clients
- [x] Soft-delete / status management (ACTIVE, AT_RISK, CHURNED)

---

## Phase 4 — Module 1: Time Tracking
**Status: ✅ Complete**

Billable hour tracking with auto-detection metadata.

### Deliverables
- [x] TimeEntry model with source, appName, windowTitle (for future desktop auto-tracking)
- [x] Time entry CRUD routes (`/api/v1/time-entries`)
- [x] Weekly summary endpoint
- [x] Billable / billed flags + hourly rate per entry
- [x] Frontend: `TimeTrackingPage.tsx` — log hours, view weekly summary
- [ ] Desktop agent for automatic time capture (not started)

---

## Phase 5 — Module 1: AI Transaction Categorization
**Status: 🟡 Partial — missing seed-demo and export/csv backend endpoints**

AI-powered bookkeeping using Groq Llama-3.3 and Swedish BAS 2024.

### Deliverables
- [x] Transaction model (Swedish BAS fields: account, vatCode, costCenter)
- [x] `GET /api/v1/transactions` — list with pagination + status filter
- [x] `POST /api/v1/transactions/:id/categorize` — single AI categorization
- [x] `POST /api/v1/transactions/:id/confirm` — confirm AI suggestion
- [x] `POST /api/v1/transactions/bulk-categorize` — batch AI categorization
- [x] Groq integration (`OpenAIService.categorizeTransaction`) with BAS chart prompting
- [x] Frontend: `TransactionsPage.tsx` — list, filter by status, categorize, confirm
- [ ] `POST /api/v1/transactions/seed-demo` — seed 20 Swedish demo transactions
- [ ] `GET /api/v1/transactions/export/csv` — CSV export of filtered transactions

---

## Phase 6 — Module 2: Advisory Revenue Engine
**Status: ✅ Complete**

AI detects advisory opportunities from client communications.

### Deliverables
- [x] AdvisoryOpportunity model (type, status, priority, estimated/actual value)
- [x] ClientActivity model (email, portal, call, meeting)
- [x] `POST /api/v1/advisory/detect` — AI advisory detection from text
- [x] `GET /api/v1/advisory/opportunities` — list with status/priority filters
- [x] `PATCH /api/v1/advisory/opportunities/:id` — update status/resolution
- [x] `GET /api/v1/advisory/dashboard` — KPIs: open opps, converted this month, value by type
- [x] Groq integration (`OpenAIService.detectAdvisoryOpportunity`)
- [x] Confidence threshold (0.6) for auto-creating opportunities
- [x] Frontend: `AdvisoryPage.tsx` — opportunities board, dashboard KPIs

---

## Phase 7 — Module 3: Client Portal & Document Requests
**Status: ✅ Complete**

Token-based document collection (no client login required).

### Deliverables
- [x] DocumentRequest model with items JSON, delivery channel, reminders
- [x] Upload model with OCR/AI processing fields
- [x] `GET/POST/PATCH /api/v1/document-requests` — CRUD
- [x] Template system (momsredovisning, arsbokslut, etc.)
- [x] `POST /api/v1/document-requests/:id/send-reminder` — SMS/email reminder
- [x] `POST /api/v1/uploads` — receive client file uploads
- [x] Token-based upload link (no login) via `uploadToken` + `tokenExpiry`
- [x] Supabase storage for uploaded files
- [x] Frontend: `DocumentRequestsPage.tsx` — create, send, track requests
- [x] Frontend: `PortalUploadPage.tsx` — public upload form (token-based)
- [x] Email service (Nodemailer SMTP + Resend API)
- [x] Email settings API + frontend Settings tab

---

## Phase 8 — Accounting Integrations
**Status: 🟡 Partial — model and routes exist, actual sync logic missing**

Connect to Scandinavian accounting platforms.

### Deliverables
- [x] AccountingIntegration model (Fortnox, Visma, Bjorn Lunden, Economic, Tripletex, etc.)
- [x] Integration CRUD routes (`/api/v1/integrations`)
- [x] SIE4 file import support (model level)
- [x] Frontend: `IntegrationsPage.tsx` — connect, list, manage integrations
- [ ] Fortnox OAuth2 flow + API sync
- [ ] Visma eAccounting OAuth2 flow + API sync
- [ ] SIE4 file parser + transaction import
- [ ] Background sync job (cron-based transaction polling)

---

## Phase 9 — Billing & Stripe
**Status: 🟡 Partial — checkout + webhooks done, schema fields missing**

SaaS billing with 3 tiers + 14-day trial.

### Deliverables
- [x] Stripe checkout session creation (`POST /api/stripe/create-checkout-session`)
- [x] Stripe webhook handler (checkout.session.completed, invoice events, subscription.deleted)
- [x] Subscription status endpoint
- [x] 14-day trial period on all plans
- [x] Landing page with pricing (`index.html` + `landing/`)
- [ ] Add Stripe fields to Prisma schema (email, stripeSubscriptionId, billing, subscriptionStatus, trialEndsAt)
- [ ] Subscription enforcement middleware (block expired/cancelled orgs)
- [ ] Customer portal link (Stripe billing portal)
- [ ] Usage quota enforcement (AI calls, SMS, users, clients per tier)

---

## Phase 10 — Testing & QA
**Status: 🟡 Partial — E2E tests written, backend unit tests missing**

End-to-end and unit testing.

### Deliverables
- [x] Playwright E2E test suite (`tests/klary-test.spec.ts`)
- [x] 9 E2E tests: dashboard, login, transactions (demo data, CSV export, filters, idempotency), clients, health
- [x] Playwright config (`playwright.config.ts`)
- [ ] Backend unit tests (routes, services, middleware)
- [ ] AI service mock tests (categorization + advisory detection)
- [ ] Integration tests for auth flows
- [ ] CI pipeline (GitHub Actions)

---

## Phase 11 — Deployment & DevOps
**Status: 🟡 Partial — Docker + Vercel config exist, CI/CD missing**

Production-ready deployment pipeline.

### Deliverables
- [x] Docker multi-stage builds for backend + frontend (`docker/`)
- [x] Docker Compose with Postgres + backend + frontend + Nginx
- [x] Nginx reverse proxy config
- [x] Vercel config for frontend (`vercel.json`)
- [ ] GitHub Actions CI/CD pipeline (test + build + deploy)
- [ ] Backend deployment config (Railway / Render / Fly.io)
- [ ] Database migration strategy for production
- [ ] Secrets management (env vars in deployment platform)
- [ ] Monitoring + alerting setup

---

## Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation & Infrastructure | ✅ Complete |
| 2 | Auth & Multi-Tenancy | ✅ Complete |
| 3 | Client Management | ✅ Complete |
| 4 | Time Tracking | ✅ Complete |
| 5 | AI Transaction Categorization | 🟡 Partial |
| 6 | Advisory Revenue Engine | ✅ Complete |
| 7 | Client Portal & Document Requests | ✅ Complete |
| 8 | Accounting Integrations | 🟡 Partial |
| 9 | Billing & Stripe | 🟡 Partial |
| 10 | Testing & QA | 🟡 Partial |
| 11 | Deployment & DevOps | 🟡 Partial |

**6 of 11 phases fully complete. 5 phases have known gaps listed above.**
