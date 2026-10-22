const prisma = require('../config/database');

// Helper function untuk mengelompokkan & memilih 1 soal acak per kategori
const getRandomQuestionsPerCategory = (questions) => {
    const grouped = {};

    // 1. Kelompokkan soal berdasarkan categoryId / categoryName
    questions.forEach(q => {
        const catKey = q.categoryId ? q.categoryId : 'uncategorized';
        if (!grouped[catKey]) {
            grouped[catKey] = [];
        }
        grouped[catKey].push(q);
    });

    // 2. Pilih 1 soal acak dari masing-masing kategori
    const selectedQuestions = [];
    for (const catKey in grouped) {
        const categoryQuestions = grouped[catKey];
        const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
        selectedQuestions.push(categoryQuestions[randomIndex]);
    }

    return selectedQuestions;
};

const getActiveQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { status: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                description: true,
                createdAt: true
            }
        });
        res.json(quizzes);
    } catch (error) {
        console.error('getActiveQuizzes error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getQuizForUnity = async (req, res) => {
    const { id } = req.params;

    try {
        const quiz = await prisma.quiz.findFirst({
            where: { id: parseInt(id), status: true },
            include: { questions: { include: { answers: true, category: true } } }
        });

        if (!quiz) return res.status(404).json({ error: 'Quiz not found or inactive' });

        // Acak & ambil 1 soal per kategori
        const randomQuestions = getRandomQuestionsPerCategory(quiz.questions);

        const formattedQuestions = randomQuestions.map(q => {
            const answersList = q.answers.map(a => a.answerText);
            const correctAnswerIndex = q.answers.findIndex(a => a.isCorrect);
            return {
                id: q.id,
                categoryName: q.category ? q.category.name : "Uncategorized",
                question: q.question,
                image: q.image ? `${req.protocol}://${req.get('host')}${q.image}` : null,
                timer: q.timer,
                answers: answersList,
                correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0
            };
        });

        res.json({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            questions: formattedQuestions
        });
    } catch (error) {
        console.error('getQuizForUnity error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const getActiveQuizForUnity = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findFirst({
            where: { status: true },
            orderBy: { createdAt: 'desc' },
            include: { questions: { include: { answers: true, category: true } } }
        });

        if (!quiz) return res.status(404).json({ error: 'No active quiz found' });

        // Acak & ambil 1 soal per kategori
        const randomQuestions = getRandomQuestionsPerCategory(quiz.questions);

        const formattedQuestions = randomQuestions.map(q => {
            const answersList = q.answers.map(a => a.answerText);
            const correctAnswerIndex = q.answers.findIndex(a => a.isCorrect);
            return {
                id: q.id,
                categoryName: q.category ? q.category.name : "Uncategorized",
                question: q.question,
                image: q.image ? `${req.protocol}://${req.get('host')}${q.image}` : null,
                timer: q.timer,
                answers: answersList,
                correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0
            };
        });

        res.json({
            id: quiz.id,
            title: quiz.title,
            description: quiz.description,
            questions: formattedQuestions
        });
    } catch (error) {
        console.error('getActiveQuizForUnity error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

const postAnswer = async (req, res) => {
    const { boothId, quizId, questionId, isCorrect } = req.body;

    try {
        if (boothId === undefined || quizId === undefined || questionId === undefined || isCorrect === undefined) {
            return res.status(400).json({ error: 'boothId, quizId, questionId, and isCorrect are required' });
        }

        const parsedBoothId = parseInt(boothId);
        const parsedQuizId = parseInt(quizId);
        const parsedQuestionId = parseInt(questionId);

        if (isNaN(parsedBoothId) || isNaN(parsedQuizId) || isNaN(parsedQuestionId)) {
            return res.status(400).json({ error: 'Invalid boothId, quizId, or questionId' });
        }

        const booth = await prisma.booth.findUnique({ where: { id: parsedBoothId } });
        if (!booth) return res.status(404).json({ error: 'Booth not found' });

        await prisma.answerLog.create({
            data: {
                boothId: parsedBoothId,
                quizId: parsedQuizId,
                questionId: parsedQuestionId,
                isCorrect: isCorrect === true || isCorrect === 'true'
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('postAnswer error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = {
    getActiveQuizzes,
    getQuizForUnity,
    getActiveQuizForUnity,
    postAnswer
};