CREATE TABLE "UserSession" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "ip" TEXT,
    "ipPrefix" TEXT,
    "userAgent" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT,
    "locationLabel" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3)
);

ALTER TABLE "UserSession"
ADD CONSTRAINT "UserSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserSession_userId_sessionId_key" ON "UserSession" ("userId", "sessionId");
CREATE INDEX "UserSession_userId_idx" ON "UserSession" ("userId");
