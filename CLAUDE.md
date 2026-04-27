# KLARY - Claude Code Instructions

## Project Overview
KLARY is a Smart Firm Intelligence Layer for Scandinavian accounting firms. It combines three modules:
1. Auto-Time & AI Automation
2. Advisory Revenue Engine  
3. Frictionless Client Portal

## Tech Stack
- **Backend**: Node.js + Express + TypeScript + Prisma + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **AI**: OpenAI GPT-4o-mini
- **Infra**: Docker + Docker Compose

## Key Commands

```bash
# Development - Backend
cd backend && npm install && npm run dev        # Start API on :4000

# Development - Frontend
cd frontend && npm install && npm run dev       # Start UI on :5173

# Database
cd backend && npx prisma migrate dev             # Run migrations
cd backend && npx prisma studio                  # Open DB UI

# Docker (production)
cd docker && docker compose up -d               # Start all services
```

## Directory Structure
```
klary/
├── backend/              # Express API
│   ├── src/
│   │   ├── server.ts     # Main entry
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, security
│   │   ├── services/     # OpenAI, etc.
│   │   └── utils/        # Prisma, crypto, logger
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   └── .env.example      # Config template
├── frontend/             # React SPA
│   ├── src/
│   │   ├── pages/        # Dashboard, Clients, etc.
│   │   ├── components/   # Layout, etc.
│   │   ├── hooks/        # useAuth (Zustand)
│   │   └── services/     # API client
│   └── index.html
├── docker/               # Docker Compose setup
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx.conf
└── README.md
```

## When Adding Features
1. **Backend**: Add route in `src/routes/`, business logic in `src/services/`, update Prisma schema if needed
2. **Frontend**: Add page in `src/pages/`, add route in `App.tsx`, add API calls in `services/api.ts`
3. **Database**: Update `prisma/schema.prisma`, run `npx prisma migrate dev`

## Security Rules
- Always use `authenticate` middleware on protected routes
- Use `requireRole` for admin-only endpoints
- Encrypt sensitive data with `utils/crypto.ts`
- Validate all inputs with Zod schemas
- Never log passwords or tokens

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - 64+ char random string
- `OPENAI_API_KEY` - For AI features
- `TWILIO_*` - Optional, for SMS