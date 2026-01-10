-- Create CustomerQuestion table
CREATE TABLE "CustomerQuestion" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "formName" TEXT NOT NULL,
    "productId" INTEGER,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerQuestion_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "CustomerQuestion_customerId_idx" ON "CustomerQuestion"("customerId");
CREATE INDEX "CustomerQuestion_productId_idx" ON "CustomerQuestion"("productId");
CREATE INDEX "CustomerQuestion_formName_idx" ON "CustomerQuestion"("formName");
CREATE INDEX "CustomerQuestion_normalized_idx" ON "CustomerQuestion"("normalized");
CREATE UNIQUE INDEX "CustomerQuestion_customerId_productId_formName_normalized_key" ON "CustomerQuestion"("customerId", "productId", "formName", "normalized");

-- Foreign keys
ALTER TABLE "CustomerQuestion"
ADD CONSTRAINT "CustomerQuestion_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerQuestion"
ADD CONSTRAINT "CustomerQuestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing customer questions from QuestionBank
INSERT INTO "CustomerQuestion" ("text", "normalized", "formName", "productId", "customerId", "createdAt", "updatedAt")
SELECT
    qb."text",
    qb."normalized",
    COALESCE(p."name", 'Custom Form') AS "formName",
    qb."productId",
    qb."customerId",
    qb."createdAt",
    qb."updatedAt"
FROM "QuestionBank" qb
LEFT JOIN "Product" p ON p."id" = qb."productId"
WHERE qb."source" = 'CUSTOMER' AND qb."customerId" IS NOT NULL;

-- Remove customer questions from QuestionBank
DELETE FROM "QuestionBank" WHERE "source" = 'CUSTOMER';
