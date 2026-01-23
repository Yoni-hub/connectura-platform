const prisma = require('../prisma')

const logClientAudit = async (targetId, action, diff = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: null,
        targetType: 'Client',
        targetId: String(targetId || ''),
        action,
        diff: diff ? JSON.stringify(diff) : null,
      },
    })
  } catch (err) {
    console.error('audit log error', err)
  }
}

module.exports = { logClientAudit }
