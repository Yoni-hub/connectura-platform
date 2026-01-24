-- Add email change pending and session revocation support.
ALTER TABLE "User"
  ADD COLUMN "emailPending" TEXT,
  ADD COLUMN "emailPendingRequestedAt" TIMESTAMP(3),
  ADD COLUMN "sessionsRevokedAt" TIMESTAMP(3);
