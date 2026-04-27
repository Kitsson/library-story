-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('KLARSTART', 'KLARPRO', 'KLARFIRM');

-- CreateEnum
CREATE TYPE "ClientSize" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'AT_RISK', 'CHURNED');

-- CreateEnum
CREATE TYPE "TimeEntryType" AS ENUM ('MANUAL', 'AUTO_TRACKED', 'CALENDAR', 'EMAIL', 'CALL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('UNCATEGORIZED', 'AI_SUGGESTED', 'CONFIRMED', 'POSTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "AdvisoryType" AS ENUM ('CASH_FLOW', 'TAX_PLANNING', 'VIRTUAL_CFO', 'YEAR_END', 'PAYROLL', 'GROWTH', 'COST_REDUCTION', 'COMPLIANCE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'PROPOSAL_SENT', 'CONVERTED', 'DISMISSED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL_RECEIVED', 'EMAIL_SENT', 'PORTAL_MESSAGE', 'CALL', 'MEETING', 'DOCUMENT_UPLOADED', 'QUESTION_ASKED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIAL', 'COMPLETED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('FORTNOX', 'VISMA_EEKONOMI', 'VISMA_EACCOUNTING', 'BJORN_LUNDEN', 'ECONOMIC', 'TRIPLETEX', 'BOKIO', 'FIKEN', 'DINERO', 'BILLY', 'SIE4_FILE');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'ERROR', 'EXPIRED', 'DISABLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "organization_id" TEXT,
    "last_login" TIMESTAMP(3),
    "login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_number" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SE',
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'KLARSTART',
    "max_users" INTEGER NOT NULL DEFAULT 3,
    "max_clients" INTEGER NOT NULL DEFAULT 10,
    "sms_quota" INTEGER NOT NULL DEFAULT 50,
    "sms_used" INTEGER NOT NULL DEFAULT 0,
    "ai_quota" INTEGER NOT NULL DEFAULT 200,
    "ai_used" INTEGER NOT NULL DEFAULT 0,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Stockholm',
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "language" TEXT NOT NULL DEFAULT 'sv',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "subscription_status" TEXT NOT NULL DEFAULT 'TRIAL',
    "billing" TEXT NOT NULL DEFAULT 'monthly',
    "trial_ends_at" TIMESTAMP(3),
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "org_number" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contact_name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "industry" TEXT,
    "size" "ClientSize" NOT NULL DEFAULT 'SMALL',
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "advice_debt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_billed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_advice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "organization_id" TEXT NOT NULL,
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_entries" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration" INTEGER NOT NULL,
    "type" "TimeEntryType" NOT NULL DEFAULT 'MANUAL',
    "category" TEXT NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate" DOUBLE PRECISION,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "app_name" TEXT,
    "window_title" TEXT,
    "confidence" DOUBLE PRECISION DEFAULT 1.0,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "suggested_account" TEXT,
    "suggested_vat_code" TEXT,
    "suggested_cost_center" TEXT,
    "ai_confidence" DOUBLE PRECISION,
    "ai_reasoning" TEXT,
    "final_account" TEXT,
    "final_vat_code" TEXT,
    "final_cost_center" TEXT,
    "categorized_by" TEXT,
    "categorized_at" TIMESTAMP(3),
    "status" "TransactionStatus" NOT NULL DEFAULT 'UNCATEGORIZED',
    "client_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advisory_opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AdvisoryType" NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "detected_by" TEXT NOT NULL,
    "evidence" TEXT,
    "estimated_hours" DOUBLE PRECISION NOT NULL,
    "estimated_value" DOUBLE PRECISION NOT NULL,
    "actual_hours" DOUBLE PRECISION,
    "actual_value" DOUBLE PRECISION,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "client_id" TEXT NOT NULL,
    "assigned_to" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisory_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "content" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "is_advisory" BOOLEAN NOT NULL DEFAULT false,
    "ai_confidence" DOUBLE PRECISION,
    "topics" TEXT[],
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "template_type" TEXT,
    "items" JSONB NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "sent_at" TIMESTAMP(3),
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completion_rate" DOUBLE PRECISION,
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "last_reminded_at" TIMESTAMP(3),
    "client_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "upload_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "ocr_text" TEXT,
    "document_type" TEXT,
    "ai_processed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "ip_address" TEXT,
    "request_id" TEXT,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_integrations" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "name" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "config" JSONB,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_org_number_key" ON "organizations"("org_number");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_subscription_id_key" ON "organizations"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_email_key" ON "organizations"("email");

-- CreateIndex
CREATE INDEX "organizations_org_number_idx" ON "organizations"("org_number");

-- CreateIndex
CREATE INDEX "clients_organization_id_idx" ON "clients"("organization_id");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "time_entries_user_id_started_at_idx" ON "time_entries"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "time_entries_client_id_idx" ON "time_entries"("client_id");

-- CreateIndex
CREATE INDEX "time_entries_type_idx" ON "time_entries"("type");

-- CreateIndex
CREATE INDEX "transactions_client_id_date_idx" ON "transactions"("client_id", "date");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_client_id_external_id_key" ON "transactions"("client_id", "external_id");

-- CreateIndex
CREATE INDEX "advisory_opportunities_client_id_status_idx" ON "advisory_opportunities"("client_id", "status");

-- CreateIndex
CREATE INDEX "advisory_opportunities_assigned_to_status_idx" ON "advisory_opportunities"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "advisory_opportunities_detected_at_idx" ON "advisory_opportunities"("detected_at");

-- CreateIndex
CREATE INDEX "client_activities_client_id_created_at_idx" ON "client_activities"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "client_activities_is_advisory_idx" ON "client_activities"("is_advisory");

-- CreateIndex
CREATE UNIQUE INDEX "document_requests_upload_token_key" ON "document_requests"("upload_token");

-- CreateIndex
CREATE INDEX "document_requests_client_id_status_idx" ON "document_requests"("client_id", "status");

-- CreateIndex
CREATE INDEX "document_requests_organization_id_idx" ON "document_requests"("organization_id");

-- CreateIndex
CREATE INDEX "document_requests_upload_token_idx" ON "document_requests"("upload_token");

-- CreateIndex
CREATE INDEX "uploads_client_id_idx" ON "uploads"("client_id");

-- CreateIndex
CREATE INDEX "uploads_request_id_idx" ON "uploads"("request_id");

-- CreateIndex
CREATE INDEX "accounting_integrations_organization_id_idx" ON "accounting_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_integrations_organization_id_provider_key" ON "accounting_integrations"("organization_id", "provider");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_created_at_idx" ON "activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_opportunities" ADD CONSTRAINT "advisory_opportunities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisory_opportunities" ADD CONSTRAINT "advisory_opportunities_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_activities" ADD CONSTRAINT "client_activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_integrations" ADD CONSTRAINT "accounting_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
