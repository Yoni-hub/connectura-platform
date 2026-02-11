-- Add input type metadata to question bank
ALTER TABLE "QuestionBank" ADD COLUMN "inputType" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "QuestionBank" ADD COLUMN "selectOptions" TEXT NOT NULL DEFAULT '[]';
