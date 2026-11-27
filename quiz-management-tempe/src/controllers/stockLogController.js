const { paginate, parsePage } = require('../helpers/pagination');
const prisma = require('../config/database');

const getStockLogs = async (req, res) => {
    const { page = 1, limit = 20 } = parsePage(req);
    const offset = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
        prisma.stockLog.findMany({
            where: {},
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: { user: true }
        }),
        prisma.stockLog.count()
    ]);

    const meta = paginate(total, page, limit);
    
    res.render('stock-logs/index', {
        logs,
        machines: await prisma.stockLog.findMany({ distinct: ['machineId'], select: { machineId: true }, orderBy: { machineId: 'asc' } }),
        users: await prisma.stockLog.findMany({ distinct: ['username'], select: { username: true }, orderBy: { username: 'asc' } }),
        filters: { machineId: req.query.machineId || '', username: req.query.username || '', from: req.query.from || '', to: req.query.to || '' },
        path: 'stock-logs',
        meta
    });
};

const postStockLog = async (req, res) => {
    const machineId = String(req.body.machineId || '').trim();
    const action = String(req.body.action || '').trim();
    const oldValue = req.body.oldValue === undefined || req.body.oldValue === null ? null : Number(req.body.oldValue);
    const newValue = Number(req.body.newValue);

    if (!machineId || machineId.length > 50) {
        return res.status(400).json({ success: false, message: 'machineId tidak valid.' });
    }
    if (!['MANUAL_SET', 'MANUAL_REFILL'].includes(action)) {
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

module.exports = { postStockLog, getStockLogs };