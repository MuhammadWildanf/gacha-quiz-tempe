const prisma = require('../config/database');

const questionBags = {};

// 1. UPDATE: Tambahkan parameter lang agar antrean soal ID dan EN terpisah
const getBalancedRandomQuestions = (questions, limit = 10, quizId = 'default', lang = 'id') => {
    const bagKey = `${quizId}_${lang}`;

    if (limit <= 0 || limit >= questions.length) {
        const all = [...questions];
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
        }
        return all;
    }

    if (!questionBags[bagKey]) {
        questionBags[bagKey] = [];
    }

    const createNewShuffledBatch = () => {
        const grouped = {};
        const priority = [];
        const priorityIds = new Set();

        questions.forEach(q => {
            const catKey = q.categoryId ? q.categoryId : 'uncategorized';
            if (!grouped[catKey]) grouped[catKey] = [];
            grouped[catKey].push(q);
        });

        for (const catKey in grouped) {
            const list = grouped[catKey];
            const picked = list[Math.floor(Math.random() * list.length)];
            priority.push(picked);
            priorityIds.add(picked.id);
        }

        for (let i = priority.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [priority[i], priority[j]] = [priority[j], priority[i]];
        }

        const rest = questions.filter(q => !priorityIds.has(q.id));
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }

        return [...priority, ...rest];
    };

    while (questionBags[bagKey].length < limit) {
        const newBatch = createNewShuffledBatch();
        const existingIds = new Set(questionBags[bagKey].map(q => q.id));

        const nonDuplicate = newBatch.filter(q => !existingIds.has(q.id));
        const duplicate = newBatch.filter(q => existingIds.has(q.id));

        questionBags[bagKey].push(...nonDuplicate, ...duplicate);
    }

    const selected = questionBags[bagKey].splice(0, limit);

    for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    return selected;
};

// 2. UPDATE BARU: Helper untuk memformat response sesuai bahasa (?lang=id atau ?lang=en)
const formatQuizResponse = (quiz, req) => {
    const lang = req.query.lang === 'en' ? 'en' : 'id';
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 10;
    const randomQuestions = getBalancedRandomQuestions(quiz.questions, limit, quiz.id, lang);

    const formattedQuestions = randomQuestions.map(q => {
        // PASTIKAN nama field Inggris di bawah (answerTextEn, questionEn, nameEn) sesuai dengan schema.prisma Anda
        const answersList = q.answers.map(a =>
            lang === 'en' && a.answerTextEn ? a.answerTextEn : a.answerText
        );
        const correctAnswerIndex = q.answers.findIndex(a => a.isCorrect);

        let categoryName = "Uncategorized";
        if (q.category) {
            categoryName = lang === 'en' && q.category.nameEn ? q.category.nameEn : q.category.name;
        }

        return {
            id: q.id,
            categoryName,
            question: lang === 'en' && q.questionEn ? q.questionEn : q.question,
            image: q.image ? `${req.protocol}://${req.get('host')}${q.image}` : null,
            timer: q.timer,
            answers: answersList,
            correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0
        };
    });

    return {
        id: quiz.id,
        title: lang === 'en' && quiz.titleEn ? quiz.titleEn : quiz.title,
        description: lang === 'en' && quiz.descriptionEn ? quiz.descriptionEn : quiz.description,
        questions: formattedQuestions
    };
};

// 3. UPDATE: Sesuaikan daftar kuis aktif dengan bahasa
const getActiveQuizzes = async (req, res) => {
    const lang = req.query.lang === 'en' ? 'en' : 'id';
    try {
        const quizzes = await prisma.quiz.findMany({
            where: { status: true },
            orderBy: { createdAt: 'desc' }
        });

        const formatted = quizzes.map(q => ({
            id: q.id,
            title: lang === 'en' && q.titleEn ? q.titleEn : q.title,
            description: lang === 'en' && q.descriptionEn ? q.descriptionEn : q.description,
            createdAt: q.createdAt
        }));

        res.json(formatted);
    } catch (error) {
        console.error('getActiveQuizzes error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// 4. UPDATE: Gunakan formatQuizResponse
const getQuizForUnity = async (req, res) => {
    const { id } = req.params;

    try {
        const quiz = await prisma.quiz.findFirst({
            where: { id: parseInt(id), status: true },
            include: { questions: { include: { answers: true, category: true } } }
        });

        if (!quiz) return res.status(404).json({ error: 'Quiz not found or inactive' });

        res.json(formatQuizResponse(quiz, req));
    } catch (error) {
        console.error('getQuizForUnity error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// 5. UPDATE: Gunakan formatQuizResponse
const getActiveQuizForUnity = async (req, res) => {
    try {
        const quiz = await prisma.quiz.findFirst({
            where: { status: true },
            orderBy: { createdAt: 'desc' },
            include: { questions: { include: { answers: true, category: true } } }
        });

        if (!quiz) return res.status(404).json({ error: 'No active quiz found' });

        res.json(formatQuizResponse(quiz, req));
    } catch (error) {
        console.error('getActiveQuizForUnity error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Tetap sama seperti sebelumnya
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
