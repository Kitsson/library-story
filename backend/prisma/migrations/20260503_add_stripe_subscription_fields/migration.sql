-- AddColumn: email, stripe_subscription_id, subscription_status, trial_ends_at, billing to organizations
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_status" TEXT NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing" TEXT NOT NULL DEFAULT 'monthly';
