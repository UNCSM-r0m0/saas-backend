ALTER TABLE "billing"."billing_usage_events"
ADD COLUMN "eventId" TEXT;

UPDATE "billing"."billing_usage_events"
SET "eventId" = "id"
WHERE "eventId" IS NULL;

ALTER TABLE "billing"."billing_usage_events"
ALTER COLUMN "eventId" SET NOT NULL;

CREATE UNIQUE INDEX "billing_usage_events_eventId_key"
ON "billing"."billing_usage_events"("eventId");

CREATE TABLE "usage"."usage_consumed_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_consumed_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_consumed_events_eventId_key"
ON "usage"."usage_consumed_events"("eventId");

CREATE INDEX "usage_consumed_events_eventType_createdAt_idx"
ON "usage"."usage_consumed_events"("eventType", "createdAt");
