-- CreateEnum
CREATE TYPE "billing"."ModelTier" AS ENUM ('PUBLIC', 'PREMIUM');

-- CreateTable
CREATE TABLE "billing"."model_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tier" "billing"."ModelTier" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "maxTokens" INTEGER,
    "fallbackModel" TEXT,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "model_configs_name_key" ON "billing"."model_configs"("name");
