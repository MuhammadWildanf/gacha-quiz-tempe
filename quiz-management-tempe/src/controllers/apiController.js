const prisma = require('../config/database');

const questionBags = {};

const getBalancedRandomQuestions = (questions, limit = 10, quizId = 'default') => {
    if (limit <= 0 || limit >= questions.length) {
        const all = [...questions];
        for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [all[i], all[j]] = [all[j], all[i]];
        }
        return all;
    }

    // Inisialisasi kantong antrean jika belum ada
    if (!questionBags[quizId]) {
        questionBags[quizId] = [];
    }

    // Fungsi bantuan untuk mengocok 1 set soal baru (tetap jamin 1 soal per kategori di awal)
    const createNewShuffledBatch = () => {
        const grouped = {};
        const priority = [];
        const priorityIds = new Set();

        questions.forEach(q => {
            const catKey = q.categoryId ? q.categoryId : 'uncategorized';
            if (!grouped[catKey]) grouped[catKey] = [];
            grouped[catKey].push(q);
        });

        // Ambil 1 perwakilan acak per kategori
        for (const catKey in grouped) {
            const list = grouped[catKey];
            const picked = list[Math.floor(Math.random() * list.length)];
            priority.push(picked);
            priorityIds.add(picked.id);
        }

        // Acak urutan perwakilan kategori
        for (let i = priority.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [priority[i], priority[j]] = [priority[j], priority[i]];
        }

        // Acak sisa soal lainnya
        const rest = questions.filter(q => !priorityIds.has(q.id));
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }

        return [...priority, ...rest];
    };

    // Jika antrean di kantong kurang dari limit (10), isi ulang kantong dengan kocokan baru
    while (questionBags[quizId].length < limit) {
        const newBatch = createNewShuffledBatch();
        const existingIds = new Set(questionBags[quizId].map(q => q.id));

        // Masukkan soal yang belum ada di sisa antrean terlebih dahulu agar tidak dobel dalam 1 sesi
        const nonDuplicate = newBatch.filter(q => !existingIds.has(q.id));
        const duplicate = newBatch.filter(q => existingIds.has(q.id));

        questionBags[quizId].push(...nonDuplicate, ...duplicate);
    }

    // Ambil 10 soal terdepan dari antrean
    const selected = questionBags[quizId].splice(0, limit);

    // Acak urutan akhir sebelum dikirim ke Unity
    for (let i = selected.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    return selected;
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
        const randomQuestions = getBalancedRandomQuestions(quiz.questions, limit, quiz.id);


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
        const randomQuestions = getBalancedRandomQuestions(quiz.questions, limit, quiz.id);

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