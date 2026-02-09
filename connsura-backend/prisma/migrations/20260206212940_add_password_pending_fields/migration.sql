-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordPendingHash" TEXT,
ADD COLUMN     "passwordPendingRequestedAt" TIMESTAMP(3);
