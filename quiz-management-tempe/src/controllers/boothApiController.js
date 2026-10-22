const prisma = require('../config/database');

const getActiveBooths = async (req, res) => {
    try {
        const booths = await prisma.booth.findMany({
            where: { status: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, description: true }
        });
        res.json(booths);
    } catch (error) {
        console.error('getActiveBooths error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getBoothStats = async (req, res) => {
    const { id } = req.params;

    try {
        const booth = await prisma.booth.findUnique({ where: { id: parseInt(id) } });
        if (!booth) return res.status(404).json({ error: 'Booth not found' });

        const gachaLogs = await prisma.gachaLog.findMany({
            where: { boothId: parseInt(id) },
            select: { score: true }
        });

        const answerLogs = await prisma.answerLog.findMany({
            where: { boothId: parseInt(id) },
            select: { isCorrect: true }
        });

        const totalPlays = gachaLogs.length;
        const averageScore = totalPlays > 0 ? (gachaLogs.reduce((sum, l) => sum + l.score, 0) / totalPlays).toFixed(1) : 0;
        const totalAnswers = answerLogs.length;
        const correctAnswers = answerLogs.filter(a => a.isCorrect).length;

        res.json({
            boothId: booth.id,
            boothName: booth.name,
            totalPlays,
            averageScore: parseFloat(averageScore),
            gachaClaims: totalPlays,
            answerStats: {
                total: totalAnswers,
                correct: correctAnswers,
                wrong: totalAnswers - correctAnswers
            }
        });
    } catch (error) {
        console.error('getBoothStats error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { getActiveBooths, getBoothStats };
