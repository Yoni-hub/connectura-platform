require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const system = await prisma.questionBank.findMany({
    where: { source: 'SYSTEM' },
    orderBy: [{ productId: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    include: { product: { select: { id: true, name: true, slug: true } } },
  });
  const customer = await prisma.customerQuestion.findMany({
    orderBy: [{ productId: 'asc' }, { id: 'asc' }],
    include: {
      product: { select: { id: true, name: true, slug: true } },
      customer: { select: { id: true, name: true, user: { select: { email: true } } } },
    },
  });
  const payload = {
    exportedAt: new Date().toISOString(),
    systemQuestions: system,
    customerQuestions: customer,
  };
  const fs = require('fs');
  const path = require('path');
  const outPath = path.resolve('..', 'docs', 'forms-questions-backup.json');
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log('Wrote', outPath, 'system:', system.length, 'customer:', customer.length);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
