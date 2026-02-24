require('dotenv').config({ path: '.env' });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const backupPath = path.resolve('..', 'docs', 'forms-questions-backup.json');
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup not found at ${backupPath}`);
  }
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const system = Array.isArray(backup.systemQuestions) ? backup.systemQuestions : [];
  if (!system.length) {
    console.log('No system questions in backup. Skipping restore.');
    await prisma.$disconnect();
    return;
  }
  const existing = await prisma.questionBank.findMany({ select: { normalized: true } });
  const existingSet = new Set(existing.map((row) => row.normalized));
  const toCreate = system
    .filter((row) => row && row.normalized && !existingSet.has(row.normalized))
    .map((row) => ({
      text: row.text,
      normalized: row.normalized,
      source: row.source || 'SYSTEM',
      productId: row.productId ?? null,
      sortOrder: row.sortOrder ?? null,
      inputType: row.inputType || 'general',
      selectOptions: row.selectOptions ? JSON.stringify(row.selectOptions) : '[]',
      helperText: typeof row.helperText === 'string' && row.helperText.trim() ? row.helperText.trim() : null,
    }));
  if (!toCreate.length) {
    console.log('All backup system questions already present.');
    await prisma.$disconnect();
    return;
  }
  const result = await prisma.questionBank.createMany({ data: toCreate, skipDuplicates: true });
  console.log(`Restored ${result.count} system questions from backup.`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
