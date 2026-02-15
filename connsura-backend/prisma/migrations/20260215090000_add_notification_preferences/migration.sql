-- Create notification preferences table
CREATE TABLE "NotificationPreferences" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL UNIQUE,
    "emailProfileUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailFeatureUpdatesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailMarketingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "preferencesVersion" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

ALTER TABLE "NotificationPreferences"
ADD CONSTRAINT "NotificationPreferences_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
