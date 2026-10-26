const prisma = require('../config/database');
const path = require('path');
const fs = require('fs');

// List Questions for a Quiz
const getQuestions = async (req, res) => {
    const { quizId } = req.params;

    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: parseInt(quizId) }
        });

        if (!quiz) {
            return res.status(404).send('Quiz not found');
        }

        const questions = await prisma.question.findMany({
            where: { quizId: parseInt(quizId) },
            orderBy: { createdAt: 'asc' },
            include: {
                answers: true,
                category: true // UPDATE: Ambil data kategori agar bisa ditampilkan di tabel List Soal
            }
        });

        res.render('questions/index', { quiz, questions, path: 'quizzes' });
    } catch (error) {
        console.error('getQuestions error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Create Form
const getCreateQuestion = async (req, res) => {
    const { quizId } = req.params;

    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: parseInt(quizId) }
        });

        if (!quiz) {
            return res.status(404).send('Quiz not found');
        }

        // UPDATE: Ambil semua list kategori untuk ditampilkan di tag <select> HTML
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });

        res.render('questions/create', { quiz, categories, path: 'quizzes', error: null });
    } catch (error) {
        console.error('getCreateQuestion error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Save New Question + Answers
const postCreateQuestion = async (req, res) => {
    const { quizId } = req.params;
    const { question, categoryId, answer1, answer2, answer3, answer4, correctAnswer, timer } = req.body;
    let imagePath = null;

    if (req.file) {
        imagePath = `/uploads/${req.file.filename}`;
    }

    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(quizId) } });
        if (!quiz) return res.status(404).send('Quiz not found');

        // Kumpulkan pilihan jawaban yang diisi
        const rawAnswers = [answer1, answer2, answer3, answer4];
        const submittedAnswers = rawAnswers
            .map((ans, idx) => ({ idx, text: typeof ans === 'string' ? ans.trim() : '' }))
            .filter(item => item.text.length > 0);

        // Validasi: Pertanyaan wajib diisi dan minimal 2 pilihan jawaban
        if (!question || !question.trim() || submittedAnswers.length < 2) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }

            const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
            let errorMsg = 'Question text and at least 2 choices (Choice A & Choice B) are required.';
            if (!question || !question.trim()) {
                errorMsg = 'Question text is required.';
            } else if (submittedAnswers.length < 2) {
                errorMsg = 'Please provide at least 2 answer choices.';
            }

            return res.render('questions/create', {
                quiz,
                categories,
                error: errorMsg,
                path: 'quizzes'
            });
        }

        // Create question
        const newQuestion = await prisma.question.create({
            data: {
                quizId: parseInt(quizId),
                categoryId: categoryId ? parseInt(categoryId) : null,
                question: question.trim(),
                image: imagePath,
                timer: parseInt(timer) || 15
            }
        });

        // Tentukan jawaban mana yang benar
        const selectedCorrectIdx = parseInt(correctAnswer);
        const isCorrectFound = submittedAnswers.some(item => item.idx === selectedCorrectIdx);

        const answersData = submittedAnswers.map((item, i) => {
            const isCorrect = isCorrectFound
                ? item.idx === selectedCorrectIdx
                : i === 0; // Fallback ke pilihan pertama jika index tidak cocok
            return {
                questionId: newQuestion.id,
                answerText: item.text,
                isCorrect
            };
        });

        // Create answers
        await prisma.answer.createMany({
            data: answersData
        });

        res.redirect(`/admin/quizzes/${quizId}/questions`);
    } catch (error) {
        console.error('postCreateQuestion error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Edit Form
const getEditQuestion = async (req, res) => {
    const { quizId, id } = req.params;

    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(quizId) } });
        if (!quiz) return res.status(404).send('Quiz not found');

        const question = await prisma.question.findUnique({
            where: { id: parseInt(id) },
            include: { answers: true, category: true }
        });

        if (!question) return res.status(404).send('Question not found');

        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });

        res.render('questions/edit', { quiz, question, categories, path: 'quizzes', error: null });
    } catch (error) {
        console.error('getEditQuestion error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Update Question + Answers
const postEditQuestion = async (req, res) => {
    const { quizId, id } = req.params;
    const { question, categoryId, answer1, answer2, answer3, answer4, correctAnswer, timer, removeImage } = req.body;

    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(quizId) } });
        if (!quiz) return res.status(404).send('Quiz not found');

        const existingQuestion = await prisma.question.findUnique({
            where: { id: parseInt(id) },
            include: { answers: true }
        });
        if (!existingQuestion) return res.status(404).send('Question not found');

        // Teks soal: gunakan yang baru jika diisi, jika kosong tetap pakai yang lama
        const finalQuestionText = (question && question.trim()) ? question.trim() : existingQuestion.question;

        // Timer: jika diisi parse integer, jika tidak gunakan timer lama / default 15
        const finalTimer = timer ? (parseInt(timer) || existingQuestion.timer || 15) : (existingQuestion.timer || 15);

        // Kategori: jika dikirim string kosong (pilih 'No Category') set null, jika ada angka set ID-nya, jika undefined pertahankan yang lama
        let finalCategoryId = existingQuestion.categoryId;
        if (categoryId !== undefined) {
            finalCategoryId = categoryId ? parseInt(categoryId) : null;
        }

        // Image Handling:
        let imagePath = existingQuestion.image;
        if (req.file) {
            // Ada file baru diupload: hapus file lama jika ada
            if (existingQuestion.image) {
                const oldPath = path.join(__dirname, '../../', existingQuestion.image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            imagePath = `/uploads/${req.file.filename}`;
        } else if (removeImage === 'true' || removeImage === '1' || removeImage === 'on') {
            // User mencentang hapus gambar
            if (existingQuestion.image) {
                const oldPath = path.join(__dirname, '../../', existingQuestion.image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            imagePath = null;
        }

        // Update Question dasar
        await prisma.question.update({
            where: { id: parseInt(id) },
            data: {
                question: finalQuestionText,
                categoryId: finalCategoryId,
                image: imagePath,
                timer: finalTimer
            }
        });

        // Answers Handling:
        const rawAnswers = [answer1, answer2, answer3, answer4];
        const submittedAnswers = rawAnswers
            .map((ans, idx) => ({ idx, text: typeof ans === 'string' ? ans.trim() : '' }))
            .filter(item => item.text.length > 0);

        if (submittedAnswers.length >= 2) {
            // Perbarui jawaban jika minimal 2 pilihan terisi
            await prisma.answer.deleteMany({
                where: { questionId: parseInt(id) }
            });

            const selectedCorrectIdx = parseInt(correctAnswer);
            const isCorrectFound = submittedAnswers.some(item => item.idx === selectedCorrectIdx);

            const answersData = submittedAnswers.map((item, i) => {
                const isCorrect = isCorrectFound
                    ? item.idx === selectedCorrectIdx
                    : i === 0; // Fallback ke pilihan pertama jika index tidak cocok
                return {
                    questionId: parseInt(id),
                    answerText: item.text,
                    isCorrect
                };
            });

            await prisma.answer.createMany({
                data: answersData
            });
        } else if (submittedAnswers.length === 1) {
            // Hanya 1 jawaban terisi, sedangkan kuis butuh minimal 2 opsi
            const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
            return res.render('questions/edit', {
                quiz,
                categories,
                question: await prisma.question.findUnique({
                    where: { id: parseInt(id) },
                    include: { answers: true, category: true }
                }),
                error: 'Minimal 2 pilihan jawaban harus diisi (misal Choice A dan Choice B)',
                path: 'quizzes'
            });
        }
        // Jika submittedAnswers.length === 0, jawaban lama tetap dipertahankan

        res.redirect(`/admin/quizzes/${quizId}/questions`);
    } catch (error) {
        console.error('postEditQuestion error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Delete Question
const deleteQuestion = async (req, res) => {
    // ... [Bagian ini tidak ada perubahan, sama seperti sebelumnya]
    const { quizId, id } = req.params;

    try {
        const question = await prisma.question.findUnique({
            where: { id: parseInt(id) }
        });

        if (!question) {
            return res.status(404).send('Question not found');
        }

        if (question.image) {
            const filePath = path.join(__dirname, '../../', question.image);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.answer.deleteMany({
            where: { questionId: parseInt(id) }
        });

        await prisma.question.delete({
            where: { id: parseInt(id) }
        });

        res.redirect(`/admin/quizzes/${quizId}/questions`);
    } catch (error) {
        console.error('deleteQuestion error:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getQuestions,
    getCreateQuestion,
    postCreateQuestion,
    getEditQuestion,
    postEditQuestion,
    deleteQuestion
};