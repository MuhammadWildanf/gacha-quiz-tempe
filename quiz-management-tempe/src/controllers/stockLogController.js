const prisma = require('../config/database');

const ALLOWED_ACTIONS = ['MANUAL_SET', 'MANUAL_REFILL'];

// POST /api/stock-logs — dipanggil Unity setelah teknisi mengubah stok.
// Username diambil dari token (req.user), bukan dari body, supaya tidak bisa dipalsukan.
const postStockLog = async (req, res) => {
    const machineId = String(req.body.machineId || '').trim();
    const action = String(req.body.action || '').trim();
    const oldValue = req.body.oldValue === undefined || req.body.oldValue === null ? null : Number(req.body.oldValue);
    const newValue = Number(req.body.newValue);

    if (!machineId || machineId.length > 50) {
        return res.status(400).json({ success: false, message: 'machineId tidak valid.' });
    }
    if (!ALLOWED_ACTIONS.includes(action)) {
        return res.status(400).json({ success: false, message: 'action tidak valid.' });
    }
    if (!Number.isInteger(newValue) || newValue < 0) {
        return res.status(400).json({ success: false, message: 'newValue harus bilangan bulat >= 0.' });
    }
    if (oldValue !== null && (!Number.isInteger(oldValue) || oldValue < 0)) {
        return res.status(400).json({ success: false, message: 'oldValue harus bilangan bulat >= 0.' });
    }

    try {
        const log = await prisma.stockLog.create({
            data: {
                machineId,
                userId: req.user.id,
                username: req.user.username,
                action,
                oldValue,
                newValue
            }
        });
        res.status(201).json({ success: true, id: log.id });
    } catch (error) {
        console.error('postStockLog error:', error.message);
        res.status(500).json({ success: false, message: 'Server gagal menyimpan log stok.' });
    }
};

// GET /admin/stock-logs — halaman log untuk admin.
const getStockLogs = async (req, res) => {
    const machineId = String(req.query.machineId || '').trim();
    const username = String(req.query.username || '').trim();
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;

    try {
        const where = {};
        if (machineId) where.machineId = machineId;
        if (username) where.username = username;
        if (from || to) {
            where.createdAt = {};
            if (from && !isNaN(from)) where.createdAt.gte = from;
            if (to && !isNaN(to)) where.createdAt.lte = to;
        }

        const [logs, machines, users] = await Promise.all([
            prisma.stockLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }),
            prisma.stockLog.findMany({ distinct: ['machineId'], select: { machineId: true }, orderBy: { machineId: 'asc' } }),
            prisma.stockLog.findMany({ distinct: ['username'], select: { username: true }, orderBy: { username: 'asc' } })
        ]);

        res.render('stock-logs/index', {
            logs,
            machines: machines.map(m => m.machineId),
            users: users.map(u => u.username),
            filters: { machineId, username, from: req.query.from || '', to: req.query.to || '' },
            path: 'stock-logs'
        });
    } catch (error) {
        console.error('getStockLogs error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = { postStockLog, getStockLogs };
