-- Add legal documents and user consents
CREATE TABLE "LegalDocument" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "LegalDocument_type_version_key" ON "LegalDocument"("type", "version");
CREATE INDEX "LegalDocument_type_publishedAt_idx" ON "LegalDocument"("type", "publishedAt");

CREATE TABLE "UserConsent" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consentItems" TEXT,
  CONSTRAINT "UserConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "UserConsent_userId_idx" ON "UserConsent"("userId");
CREATE INDEX "UserConsent_documentType_version_idx" ON "UserConsent"("documentType", "version");
