const prisma = require('../config/database');
const { MACHINE_IDS } = require('../config/machines');

const STOCK_PUSH_BASE = (process.env.SERVER_GACHA_URL || '').replace(/\/$/, '');
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || '';

function isKnownMachine(machineId) {
    return MACHINE_IDS.includes(machineId);
}

async function ensureStock(db, machineId) {
    return db.machineStock.upsert({
        where: { machineId },
        update: {},
        create: { machineId }
    });
}

// Kirim stok terbaru ke mesin lewat server Gacha. Gagal = mesin ambil nilainya saat tersambung.
async function pushToMachine(machineId, row) {
    if (!STOCK_PUSH_BASE || !INTERNAL_KEY) return false;
    try {
        const res = await fetch(STOCK_PUSH_BASE + '/api/internal/stock-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
            body: JSON.stringify({ machineId, stock: row.stock, version: row.version }),
            signal: AbortSignal.timeout(5000)
        });
        const data = await res.json().catch(() => ({}));
        return res.ok && data.delivered === true;
    } catch (error) {
        console.error('pushToMachine error:', error.message);
        return false;
    }
}

// GET /api/internal/machines/:machineId/stock
const getInternalStock = async (req, res) => {
    const { machineId } = req.params;
    if (!isKnownMachine(machineId)) {
        return res.status(404).json({ success: false, message: 'Mesin tidak terdaftar.' });
    }
    try {
        const row = await ensureStock(prisma, machineId);
        res.json({ success: true, machineId, stock: row.stock, version: row.version });
    } catch (error) {
        console.error('getInternalStock error:', error.message);
        res.status(500).json({ success: false, message: 'Server gagal membaca stok.' });
    }
};

// POST /api/internal/stock-events — hadiah keluar dari mesin (delta selalu -1).
const postDispenseEvent = async (req, res) => {
    const { machineId, eventId } = req.body || {};
    const baseVersion = Number.parseInt(req.body?.baseVersion, 10);

    if (!isKnownMachine(machineId)) {
        return res.status(404).json({ success: false, message: 'Mesin tidak terdaftar.' });
    }
    if (!eventId || typeof eventId !== 'string' || eventId.length > 64) {
        return res.status(400).json({ success: false, message: 'eventId tidak valid.' });
    }
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
        return res.status(400).json({ success: false, message: 'baseVersion tidak valid.' });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const duplicate = await tx.stockLog.findUnique({ where: { eventId } });
            const row = await ensureStock(tx, machineId);
            if (duplicate) return { applied: false, duplicate: true, row };

            // Event dari versi lama: admin sudah mengatur stok setelah itu, jadi diabaikan.
            if (baseVersion < row.version) {
                await tx.stockLog.create({
                    data: { machineId, username: 'system', action: 'DISPENSE_STALE', oldValue: row.stock, newValue: row.stock, eventId }
                });
                return { applied: false, duplicate: false, row };
            }

            const newStock = Math.max(0, row.stock - 1);
            // Kurangi secara atomik agar dua event bersamaan tidak saling menimpa.
            const dec = await tx.machineStock.update({
                where: { machineId },
                data: { stock: { decrement: 1 } }
            });
            const updated = dec.stock < 0
                ? await tx.machineStock.update({ where: { machineId }, data: { stock: 0 } })
                : dec;
            await tx.stockLog.create({
                data: {
                    machineId,
                    username: 'system',
                    action: 'DISPENSE',
                    oldValue: Math.max(0, dec.stock + 1),
                    newValue: updated.stock,
                    eventId
                }
            });
            return { applied: true, duplicate: false, row: updated };
        });

        res.json({
            success: true,
            applied: result.applied,
            duplicate: result.duplicate,
            stock: result.row.stock,
            version: result.row.version
        });
    } catch (error) {
        // Dua permintaan dengan eventId sama datang bersamaan: anggap duplikat.
        if (error.code === 'P2002') {
            const row = await ensureStock(prisma, machineId);
            return res.json({ success: true, applied: false, duplicate: true, stock: row.stock, version: row.version });
        }
        console.error('postDispenseEvent error:', error.message);
        res.status(500).json({ success: false, message: 'Server gagal menyimpan event stok.' });
    }
};

// GET /admin/machines
const getMachines = async (req, res) => {
    try {
        const rows = await Promise.all(MACHINE_IDS.map(id => ensureStock(prisma, id)));
        res.render('machines/index', {
            machines: rows,
            success: req.query.success || null,
            error: req.query.error || null,
            path: 'machines'
        });
    } catch (error) {
        console.error('getMachines error:', error.message);
        res.status(500).send('Internal Server Error');
    }
};

// POST /admin/machines/:machineId/stock — atur stok manual (admin & operator).
const postManualStock = async (req, res) => {
    const { machineId } = req.params;
    if (!isKnownMachine(machineId)) {
        return res.redirect(`/admin/machines?error=${encodeURIComponent('Mesin tidak terdaftar.')}`);
    }
    const value = Number.parseInt(req.body.stock, 10);
    if (!Number.isInteger(value) || value < 0) {
        return res.redirect(`/admin/machines?error=${encodeURIComponent('Stok harus angka 0 atau lebih.')}`);
    }

    try {
        const row = await prisma.$transaction(async (tx) => {
            const before = await ensureStock(tx, machineId);
            const after = await tx.machineStock.update({
                where: { machineId },
                data: { stock: value, version: before.version + 1 }
            });
            await tx.stockLog.create({
                data: {
                    machineId,
                    userId: req.user.id,
                    username: req.user.username,
                    action: 'MANUAL_SET',
                    oldValue: before.stock,
                    newValue: value
                }
            });
            return after;
        });

        const delivered = await pushToMachine(machineId, row);
        const note = delivered
            ? `Stok ${machineId} disimpan (${row.stock}) dan langsung dikirim ke mesin.`
            : `Stok ${machineId} disimpan (${row.stock}). Mesin belum terhubung, akan menerima saat tersambung.`;
        res.redirect(`/admin/machines?success=${encodeURIComponent(note)}`);
    } catch (error) {
        console.error('postManualStock error:', error.message);
        res.redirect(`/admin/machines?error=${encodeURIComponent('Gagal menyimpan stok.')}`);
    }
};

module.exports = {
    getInternalStock,
    postDispenseEvent,
    getMachines,
    postManualStock
};
