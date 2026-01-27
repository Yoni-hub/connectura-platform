-- Add sortOrder to QuestionBank and backfill based on id order per product.
ALTER TABLE "QuestionBank" ADD COLUMN "sortOrder" INTEGER;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "productId" ORDER BY id) AS rn
  FROM "QuestionBank"
)
UPDATE "QuestionBank" qb
SET "sortOrder" = ranked.rn
FROM ranked
WHERE qb.id = ranked.id;
