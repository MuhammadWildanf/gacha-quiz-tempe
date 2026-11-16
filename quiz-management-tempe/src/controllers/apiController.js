const prisma = require('../config/database');

const getBalancedRandomQuestions = (questions, limit = 10) => {
    const grouped = {};
    const selectedQuestions = [];
    const selectedIds = new Set();

    // Kelompokkan soal berdasarkan categoryId
    questions.forEach(q => {
        const catKey = q.categoryId ? q.categoryId : 'uncategorized';
        if (!grouped[catKey]) {
            grouped[catKey] = [];
        }
        grouped[catKey].push(q);
    });

    // Ambil 1 soal acak dari masing-masing kategori (menjamin semua kategori pasti terwakili)
    for (const catKey in grouped) {
        const categoryQuestions = grouped[catKey];
        const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
        const picked = categoryQuestions[randomIndex];

        selectedQuestions.push(picked);
        selectedIds.add(picked.id);
    }

    // Kumpulkan sisa soal yang belum terpilih, lalu acak urutannya
    const remainingQuestions = questions.filter(q => !selectedIds.has(q.id));
    for (let i = remainingQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingQuestions[i], remainingQuestions[j]] = [remainingQuestions[j], remainingQuestions[i]];
    }

    // Gabungkan soal perwakilan kategori + sisa soal acak
    const combined = [...selectedQuestions, ...remainingQuestions];

    // Potong sesuai limit (jika limit <= 0, tampilkan semua soal)
    const finalList = (limit > 0) ? combined.slice(0, limit) : combined;

    // Acak urutan akhir agar posisi kategori tersebar rata
    for (let i = finalList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalList[i], finalList[j]] = [finalList[j], finalList[i]];
    }

    return finalList;
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

        // 2. PERBAIKAN PEMANGGILAN: Baca ?limit= dari URL (default 10 soal)
        const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 10;
        const randomQuestions = getBalancedRandomQuestions(quiz.questions, limit);

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

        // 3. PERBAIKAN PEMANGGILAN: Baca ?limit= dari URL (default 10 soal)
        const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 10;
        const randomQuestions = getBalancedRandomQuestions(quiz.questions, limit);

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