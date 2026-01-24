-- Add passwordChangedAt to invalidate old tokens on password updates.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
