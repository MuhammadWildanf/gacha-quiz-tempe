const prisma = require('../config/database');

// Mencatat perubahan user & role. Kegagalan mencatat hanya di-log, tidak membatalkan aksi.
async function recordAudit({ actor, action, target, detail }) {
    try {
        await prisma.auditLog.create({
            data: {
                actorId: actor ? actor.id : null,
                actorName: actor ? actor.username : 'system',
                action,
                target,
                detail: detail ? JSON.stringify(detail) : null
            }
        });
    } catch (error) {
        console.error('recordAudit error:', error.message);
    }
}

module.exports = { recordAudit };
