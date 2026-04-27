# KLARY - Smart Firm Intelligence Layer

**KLARY** is a comprehensive platform that combines AI-powered automation, advisory revenue optimization, and frictionless client communication into one unified system for Scandinavian accounting firms.

## What KLARY Does

| Module | Problem Solved | Value Delivered |
|---|---|---|
| **Auto-Time & AI Automation** | 40% of accountant time wasted on manual data entry | Reclaims 15-25 hours/week |
| **Advisory Revenue Engine** | 60 hours/season of "free advice" leaks unmonetized | Generates 90K-185K SEK/yr per partner |
| **Frictionless Client Portal** | 64% cite "chasing documents" as #1 bottleneck | 67-74% document completion (vs 38-44% email) |

## Tech Stack

**Backend:** Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
**Frontend:** React + Vite + TypeScript + Tailwind CSS + Zustand
**AI:** OpenAI GPT-4o-mini for transaction categorization & advisory detection
**Infrastructure:** Docker + Docker Compose + Nginx

## Quick Start (Docker)

The fastest way to get KLARY running:

```bash
# 1. Clone and enter the project
cd klary

# 2. Copy environment file
cp backend/.env.example backend/.env

# 3. Edit backend/.env with your secrets
# Required: JWT_SECRET (64+ char random string)
# Required: OPENAI_API_KEY (for AI features)
# Optional: TWILIO_* (for SMS features)

# 4. Start everything
cd docker && docker compose up -d

# 5. Run database migrations
docker compose exec backend npx prisma migrate dev

# 6. Seed the database (optional)
docker compose exec backend npm run db:seed

# 7. Open http://localhost
```

## Development Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database URL and secrets

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

The API will be available at `http://localhost:4000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 64+ character random string |
| `OPENAI_API_KEY` | Yes | For AI categorization & advisory detection |
| `TWILIO_ACCOUNT_SID` | No | For SMS document requests |
| `TWILIO_AUTH_TOKEN` | No | For SMS document requests |
| `TWILIO_PHONE_NUMBER` | No | Sender phone number |

## Security Checklist

KLARY implements enterprise-grade security:

- [x] **Password hashing** - bcrypt with 12 rounds
- [x] **JWT authentication** - Signed tokens with expiry
- [x] **Rate limiting** - 100 req/15min per IP, 10 login attempts per 15min
- [x] **Account lockout** - 30min lock after 5 failed attempts
- [x] **Helmet security headers** - CSP, HSTS, X-Frame-Options, etc.
- [x] **CORS protection** - Configured for specific origins only
- [x] **Input validation** - Zod schemas + SQL injection & XSS filtering
- [x] **Token encryption** - AES-256-GCM for API credentials
- [x] **GDPR compliance** - EU data residency, DPA available
- [x] **Audit logging** - All data access logged
- [x] **Non-root Docker** - Services run as unprivileged user
- [x] **HTTPS enforcement** - HSTS with preload

## Monthly Operating Costs (Production)

| Service | Provider | Cost/Month |
|---|---|---|
| VPS (2 CPU, 4GB RAM) | Hetzner/DigitalOcean | $12-20 |
| PostgreSQL Database | Self-hosted / Supabase | $0-25 |
| OpenAI API (GPT-4o-mini) | OpenAI | $20-50 |
| SMS (Twilio) | Twilio | $10-30 |
| Domain + SSL | Cloudflare / Let's Encrypt | $0-10 |
| **Total** | | **$42-135/month** |

*Scales with usage. AI costs depend on transaction volume. SMS costs depend on document request volume.*

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/auth/register` | POST | Register new organization |
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/auth/me` | GET | Current user |
| `/api/v1/dashboard/summary` | GET | Dashboard summary |
| `/api/v1/clients` | GET/POST | List/Create clients |
| `/api/v1/time-entries` | GET/POST | List/Create time entries |
| `/api/v1/transactions` | GET | List transactions |
| `/api/v1/transactions/:id/categorize` | POST | AI categorization |
| `/api/v1/advisory/opportunities` | GET | Advisory opportunities |
| `/api/v1/document-requests` | GET/POST | List/Create doc requests |
| `/api/v1/integrations` | GET/POST | List/Connect integrations |

## Database Schema

See `backend/prisma/schema.prisma` for the complete data model covering:
- Users & Organizations with RBAC
- Clients with advisory scoring
- Time Entries (manual + auto-tracked)
- Transactions with AI categorization
- Advisory Opportunities pipeline
- Document Requests with SMS delivery
- Accounting Software Integrations
- Activity Logs for audit trail

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details.

---

**Built with care for Scandinavian accounting firms.**