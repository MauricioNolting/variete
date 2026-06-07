-- AlterTable: add passwordHash to Client
ALTER TABLE "Client" ADD COLUMN "passwordHash" TEXT;

-- CreateTable: TierBenefit
CREATE TABLE "TierBenefit" (
    "id" SERIAL NOT NULL,
    "tier" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TierBenefit_pkey" PRIMARY KEY ("id")
);
