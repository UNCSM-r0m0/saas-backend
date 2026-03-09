CREATE TABLE "billing"."billing_usage_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "model" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_usage_events_eventType_occurredAt_idx"
ON "billing"."billing_usage_events"("eventType", "occurredAt");

CREATE INDEX "billing_usage_events_userId_occurredAt_idx"
ON "billing"."billing_usage_events"("userId", "occurredAt");

CREATE INDEX "billing_usage_events_conversationId_occurredAt_idx"
ON "billing"."billing_usage_events"("conversationId", "occurredAt");
