-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TierBenefit" ADD COLUMN     "expiryDays" INTEGER;
