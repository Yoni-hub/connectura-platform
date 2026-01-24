-- Create EmailOtp table
CREATE TABLE "EmailOtp" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "lastSentIp" TEXT,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- Unique index for active email OTPs
CREATE UNIQUE INDEX "EmailOtp_email_key" ON "EmailOtp"("email");

-- Create EmailOtpRequest table
CREATE TABLE "EmailOtpRequest" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpRequest_pkey" PRIMARY KEY ("id")
);

-- Indexes for rate limiting
CREATE INDEX "EmailOtpRequest_email_createdAt_idx" ON "EmailOtpRequest"("email", "createdAt");
CREATE INDEX "EmailOtpRequest_ip_createdAt_idx" ON "EmailOtpRequest"("ip", "createdAt");
