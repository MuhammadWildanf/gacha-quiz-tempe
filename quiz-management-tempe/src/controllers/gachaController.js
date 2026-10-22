const prisma = require('../config/database');

const getSettings = async (req, res) => {
    try {
        let setting = await prisma.gachaSetting.findUnique({ where: { id: 1 } });
        if (!setting) {
            setting = await prisma.gachaSetting.create({ data: { id: 1, minCorrectAnswers: 3 } });
        }

        const logs = await prisma.gachaLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: { booth: true }
        });

        res.render('gacha/settings', {
            setting,
            logs,
            path: 'gacha',
            success: req.query.success || null
        });
    } catch (error) {
        console.error('getSettings error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const postSettings = async (req, res) => {
    const { minCorrectAnswers } = req.body;

    try {
        const value = parseInt(minCorrectAnswers);
        if (isNaN(value) || value < 1) {
            return res.redirect('/admin/gacha?error=invalid');
        }

        await prisma.gachaSetting.upsert({
            where: { id: 1 },
            update: { minCorrectAnswers: value },
            create: { id: 1, minCorrectAnswers: value }
        });

        res.redirect('/admin/gacha?success=1');
    } catch (error) {
        console.error('postSettings error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getApiSettings = async (req, res) => {
    try {
        let setting = await prisma.gachaSetting.findUnique({ where: { id: 1 } });
        if (!setting) {
            setting = await prisma.gachaSetting.create({ data: { id: 1, minCorrectAnswers: 3 } });
        }

        res.json({ minCorrectAnswers: setting.minCorrectAnswers });
    } catch (error) {
        console.error('getApiSettings error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const postLog = async (req, res) => {
    const { boothId, quizId, score, totalQuestions } = req.body;

    try {
        if (quizId === undefined || score === undefined) {
            return res.status(400).json({ error: 'quizId and score are required' });
        }

        const parsedScore = parseInt(score);
        const parsedQuizId = parseInt(quizId);
        const parsedBoothId = boothId ? parseInt(boothId) : null;
        const parsedTotalQuestions = totalQuestions ? parseInt(totalQuestions) : null;

        if (isNaN(parsedScore) || parsedScore < 0 || isNaN(parsedQuizId)) {
            return res.status(400).json({ error: 'Invalid score or quizId' });
        }

        if (parsedBoothId !== null && isNaN(parsedBoothId)) {
            return res.status(400).json({ error: 'Invalid boothId' });
        }

        if (parsedBoothId !== null) {
            const booth = await prisma.booth.findUnique({ where: { id: parsedBoothId } });
            if (!booth) return res.status(404).json({ error: 'Booth not found' });
        }

        await prisma.gachaLog.create({
            data: {
                boothId: parsedBoothId,
                quizId: parsedQuizId,
                score: parsedScore,
                totalQuestions: parsedTotalQuestions
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('postLog error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    getSettings,
    postSettings,
    getApiSettings,
    postLog
};
