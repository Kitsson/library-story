# KLARY — Smart Firm Intelligence Layer

## What it is
KLARY is a SaaS platform for Scandinavian accounting firms. It automates the manual, time-consuming work of accounting (time tracking, transaction categorization, document collection) and converts that data into advisory revenue opportunities — the highest-margin work firms never had time to pursue.

## Three Core Modules
1. **Auto-Time & AI Automation** — tracks billable hours automatically, AI-categorizes transactions using the Swedish BAS chart of accounts (via Groq Llama-3.3-70b)
2. **Advisory Revenue Engine** — detects advisory opportunities in client communications using AI, tracks conversion from detection → proposal → revenue
3. **Frictionless Client Portal** — token-based document request + upload system (no client login needed), with SMS/email delivery

## Tech Stack
- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **AI**: Groq (llama-3.3-70b-versatile) for transaction categorization and advisory detection
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + React Query + Zustand
- **Payments**: Stripe (checkout, subscriptions, webhooks)
- **Email**: Nodemailer (SMTP) + Resend
- **Storage**: Supabase (file uploads)
- **Infra**: Docker + Docker Compose + Vercel (frontend)

## Business Context
- Target market: Swedish/Scandinavian accounting firms
- Pricing tiers: KlarStart / KlarPro / KlarFirm
- Languages: Swedish (sv) default
- Currency: SEK default
- Regulatory: BAS 2024 chart of accounts, Swedish VAT codes

## Codebase Root
`/home/user/library-story`
- `backend/` — Express API (port 4000)
- `frontend/` — React SPA (port 5173)
- `docker/` — Docker Compose for production
- `tests/` — Playwright E2E tests
- `landing/` — Static landing page
