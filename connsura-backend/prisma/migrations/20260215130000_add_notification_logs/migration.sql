CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SECURITY', 'LEGAL');
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED');
CREATE TYPE "NotificationActorType" AS ENUM ('USER', 'SYSTEM', 'ADMIN');

CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "NotificationChannel" NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL,
    "userId" INTEGER,
    "recipientEmail" TEXT,
    "recipientUserAgentHash" TEXT,
    "subject" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "status" "NotificationStatus" NOT NULL,
    "failureReason" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "preferenceSnapshot" JSONB,
    "metadata" JSONB,
    "actorType" "NotificationActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorUserId" INTEGER,
    "correlationId" TEXT,
    "dedupeKey" TEXT,
    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationLog"
ADD CONSTRAINT "NotificationLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog" ("createdAt");
CREATE INDEX "NotificationLog_userId_createdAt_idx" ON "NotificationLog" ("userId", "createdAt");
CREATE INDEX "NotificationLog_eventType_createdAt_idx" ON "NotificationLog" ("eventType", "createdAt");
CREATE INDEX "NotificationLog_status_createdAt_idx" ON "NotificationLog" ("status", "createdAt");
CREATE UNIQUE INDEX "NotificationLog_providerMessageId_key" ON "NotificationLog" ("providerMessageId");
