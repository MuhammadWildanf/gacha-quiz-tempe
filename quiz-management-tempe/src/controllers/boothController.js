const prisma = require('../config/database');

const getBooths = async (req, res) => {
    try {
        const booths = await prisma.booth.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { gachaLogs: true, answerLogs: true }
                }
            }
        });
        res.render('booths/index', { booths, path: 'booths', success: req.query.success || null });
    } catch (error) {
        console.error('getBooths error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getCreateBooth = (req, res) => {
    res.render('booths/create', { path: 'booths' });
};

const postCreateBooth = async (req, res) => {
    const { name, description } = req.body;

    try {
        if (!name || !name.trim()) {
            return res.render('booths/create', { error: 'Nama booth wajib diisi', path: 'booths' });
        }

        const existing = await prisma.booth.findFirst({ where: { name: name.trim() } });
        if (existing) {
            return res.render('booths/create', { error: 'Nama booth sudah digunakan', path: 'booths' });
        }

        await prisma.booth.create({
            data: {
                name: name.trim(),
                description: description ? description.trim() : null
            }
        });

        res.redirect('/admin/booths?success=created');
    } catch (error) {
        console.error('postCreateBooth error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getEditBooth = async (req, res) => {
    const { id } = req.params;

    try {
        const booth = await prisma.booth.findUnique({ where: { id: parseInt(id) } });
        if (!booth) return res.status(404).send('Booth not found');

        res.render('booths/edit', { booth, path: 'booths' });
    } catch (error) {
        console.error('getEditBooth error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const postEditBooth = async (req, res) => {
    const { id } = req.params;
    const { name, description, status } = req.body;

    try {
        if (!name || !name.trim()) {
            const booth = await prisma.booth.findUnique({ where: { id: parseInt(id) } });
            return res.render('booths/edit', { booth, error: 'Nama booth wajib diisi', path: 'booths' });
        }

        const existing = await prisma.booth.findFirst({
            where: { name: name.trim(), id: { not: parseInt(id) } }
        });
        if (existing) {
            const booth = await prisma.booth.findUnique({ where: { id: parseInt(id) } });
            return res.render('booths/edit', { booth, error: 'Nama booth sudah digunakan', path: 'booths' });
        }

        await prisma.booth.update({
            where: { id: parseInt(id) },
            data: {
                name: name.trim(),
                description: description ? description.trim() : null,
                status: status === 'true' || status === true
            }
        });

        res.redirect('/admin/booths?success=updated');
    } catch (error) {
        console.error('postEditBooth error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const deleteBooth = async (req, res) => {
    const { id } = req.params;

    try {
        await prisma.answerLog.deleteMany({ where: { boothId: parseInt(id) } });
        await prisma.gachaLog.deleteMany({ where: { boothId: parseInt(id) } });
        await prisma.booth.delete({ where: { id: parseInt(id) } });

        res.redirect('/admin/booths?success=deleted');
    } catch (error) {
        console.error('deleteBooth error:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getBooths,
    getCreateBooth,
    postCreateBooth,
    getEditBooth,
    postEditBooth,
    deleteBooth
};
