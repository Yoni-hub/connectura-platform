-- CreateEnum
CREATE TYPE "PassportProductSource" AS ENUM ('ADMIN_PRODUCT', 'CUSTOM_PRODUCT');

-- CreateTable
CREATE TABLE "PassportProductInstance" (
    "id" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productSource" "PassportProductSource" NOT NULL,
    "adminProductId" INTEGER,
    "productName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PassportProductInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportCustomQuestion" (
    "id" TEXT NOT NULL,
    "productInstanceId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'general',
    "options" JSONB,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassportCustomQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportSectionResponse" (
    "id" TEXT NOT NULL,
    "productInstanceId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportSectionResponse_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "formSchema" TEXT NOT NULL DEFAULT '{"sections":[]}';

-- CreateIndex
CREATE INDEX "PassportProductInstance_customerId_updatedAt_idx" ON "PassportProductInstance"("customerId", "updatedAt");
CREATE INDEX "PassportProductInstance_adminProductId_idx" ON "PassportProductInstance"("adminProductId");
CREATE INDEX "PassportCustomQuestion_productInstanceId_orderIndex_idx" ON "PassportCustomQuestion"("productInstanceId", "orderIndex");
CREATE UNIQUE INDEX "PassportSectionResponse_productInstanceId_sectionKey_key" ON "PassportSectionResponse"("productInstanceId", "sectionKey");
CREATE INDEX "PassportSectionResponse_productInstanceId_idx" ON "PassportSectionResponse"("productInstanceId");

-- AddForeignKey
ALTER TABLE "PassportProductInstance" ADD CONSTRAINT "PassportProductInstance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PassportProductInstance" ADD CONSTRAINT "PassportProductInstance_adminProductId_fkey" FOREIGN KEY ("adminProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PassportCustomQuestion" ADD CONSTRAINT "PassportCustomQuestion_productInstanceId_fkey" FOREIGN KEY ("productInstanceId") REFERENCES "PassportProductInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PassportSectionResponse" ADD CONSTRAINT "PassportSectionResponse_productInstanceId_fkey" FOREIGN KEY ("productInstanceId") REFERENCES "PassportProductInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
