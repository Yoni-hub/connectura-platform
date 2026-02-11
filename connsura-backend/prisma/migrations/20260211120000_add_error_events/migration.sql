-- Create error events
CREATE TABLE "ErrorEvent" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'error',
    "source" TEXT NOT NULL DEFAULT 'frontend',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "componentStack" TEXT,
    "release" TEXT,
    "sessionId" TEXT,
    "fingerprint" TEXT,
    "metadata" TEXT,
    "userId" INTEGER,

    CONSTRAINT "ErrorEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorEvent_createdAt_idx" ON "ErrorEvent"("createdAt");
CREATE INDEX "ErrorEvent_level_idx" ON "ErrorEvent"("level");
CREATE INDEX "ErrorEvent_source_idx" ON "ErrorEvent"("source");
CREATE INDEX "ErrorEvent_userId_idx" ON "ErrorEvent"("userId");

ALTER TABLE "ErrorEvent" ADD CONSTRAINT "ErrorEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
