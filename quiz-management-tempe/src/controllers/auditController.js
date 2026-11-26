const prisma = require('../config/database');

const ACTIONS = [
    'USER_CREATE',
    'USER_UPDATE',
    'USER_DELETE',
    'ROLE_PERMISSIONS_UPDATE'
];

function parseDetail(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
}

function describeDetail(action, detail) {
    if (!detail) return '-';
    if (action === 'USER_UPDATE') {
        return Object.entries(detail).map(([field, change]) => {
            if (change === 'diganti') return 'password diganti';
            return `${field}: ${change.from ?? '-'} → ${change.to ?? '-'}`;
        }).join('; ');
    }
    if (action === 'ROLE_PERMISSIONS_UPDATE') {
        const parts = [];
        if (detail.granted && detail.granted.length) parts.push(`ditambah: ${detail.granted.join(', ')}`);
        if (detail.revoked && detail.revoked.length) parts.push(`dicabut: ${detail.revoked.join(', ')}`);
        return parts.join(' | ') || '-';
    }
    return Object.entries(detail).map(([k, v]) => `${k}: ${v}`).join(', ');
}

// GET /admin/audit-logs
const getAuditLogs = async (req, res) => {
    const action = String(req.query.action || '').trim();
    const actor = String(req.query.actor || '').trim();
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;

    try {
        const where = {};
        if (action && ACTIONS.includes(action)) where.action = action;
        if (actor) where.actorName = actor;
        if (from || to) {
            where.createdAt = {};
            if (from && !isNaN(from)) where.createdAt.gte = from;
            if (to && !isNaN(to)) where.createdAt.lte = to;
        }

        const [rows, actors] = await Promise.all([
            prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }),
            prisma.auditLog.findMany({ distinct: ['actorName'], select: { actorName: true }, orderBy: { actorName: 'asc' } })
        ]);

        const logs = rows.map(row => ({
            ...row,
            detailText: describeDetail(row.action, parseDetail(row.detail))
        }));

        res.render('audit-logs/index', {
            logs,
            actions: ACTIONS,
            actors: actors.map(a => a.actorName),
            filters: { action, actor, from: req.query.from || '', to: req.query.to || '' },
            path: 'audit-logs'
        });
    } catch (error) {
        console.error('getAuditLogs error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { getAuditLogs };
