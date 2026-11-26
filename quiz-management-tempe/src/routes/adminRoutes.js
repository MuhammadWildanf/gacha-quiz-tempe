const express = require('express');
const router = express.Router();
const prisma = require('../config/database');
const { protect, requirePermission } = require('../middleware/authMiddleware');

// Protect all admin routes
router.use(protect);

router.get('/dashboard', requirePermission('dashboard.view'), async (req, res) => {
    try {
        const totalQuizzes = await prisma.quiz.count();
        const totalQuestions = await prisma.question.count();
        const totalBooths = await prisma.booth.count();

        // Fetch active quizzes
        const activeQuizzes = await prisma.quiz.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { questions: true }
                }
            }
        });

        res.render('dashboard', {
            stats: {
                totalQuizzes,
                totalQuestions,
                totalBooths
            },
            activeQuizzes,
            path: 'dashboard' // Used to highlight active sidebar item
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
