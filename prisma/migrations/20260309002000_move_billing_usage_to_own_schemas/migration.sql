-- Move billing and usage domain objects to dedicated schemas.
CREATE SCHEMA IF NOT EXISTS "billing";
CREATE SCHEMA IF NOT EXISTS "usage";

-- Billing enums and table.
ALTER TYPE "public"."SubscriptionTier" SET SCHEMA "billing";
ALTER TYPE "public"."SubscriptionStatus" SET SCHEMA "billing";
ALTER TABLE "public"."subscriptions" SET SCHEMA "billing";

-- Usage table.
ALTER TABLE "public"."usage_records" SET SCHEMA "usage";
