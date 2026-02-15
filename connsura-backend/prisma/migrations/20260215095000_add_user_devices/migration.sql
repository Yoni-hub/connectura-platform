CREATE TABLE "UserDevice" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastIpPrefix" TEXT,
    "lastUserAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "UserDevice"
ADD CONSTRAINT "UserDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "UserDevice_userId_deviceId_key" ON "UserDevice" ("userId", "deviceId");
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice" ("userId");
