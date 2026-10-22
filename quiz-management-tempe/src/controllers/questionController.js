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
    // UPDATE: Ambil input categoryId dari req.body
    const { question, categoryId, answer1, answer2, answer3, answer4, correctAnswer, timer } = req.body;
    let imagePath = null;

    if (req.file) {
        imagePath = `/uploads/${req.file.filename}`;
    }

    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(quizId) } });
        if (!quiz) return res.status(404).send('Quiz not found');

        if (!question || !answer1 || !answer2 || !answer3 || !answer4 || correctAnswer === undefined) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }

            // UPDATE: Fetch kategori lagi jika validasi gagal, agar form tidak error saat re-render
            const categories = await prisma.category.findMany();
            return res.render('questions/create', {
                quiz,
                categories,
                error: 'All fields including question, 4 answers, and correct answer are required',
                path: 'quizzes'
            });
        }

        // Create question
        const newQuestion = await prisma.question.create({
            data: {
                quizId: parseInt(quizId),
                categoryId: categoryId ? parseInt(categoryId) : null, // UPDATE: Simpan categoryId ke database
                question,
                image: imagePath,
                timer: parseInt(timer) || 15
            }
        });

        // Prepare choices
        const answersData = [
            { questionId: newQuestion.id, answerText: answer1, isCorrect: correctAnswer === '0' },
            { questionId: newQuestion.id, answerText: answer2, isCorrect: correctAnswer === '1' },
            { questionId: newQuestion.id, answerText: answer3, isCorrect: correctAnswer === '2' },
            { questionId: newQuestion.id, answerText: answer4, isCorrect: correctAnswer === '3' }
        ];

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
            include: { answers: true, category: true } // UPDATE: include category
        });

        if (!question) return res.status(404).send('Question not found');

        // UPDATE: Ambil semua list kategori untuk ditampilkan di tag <select> edit form
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
    // UPDATE: Ambil input categoryId dari req.body
    const { question, categoryId, answer1, answer2, answer3, answer4, correctAnswer, timer } = req.body;

    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(quizId) } });
        if (!quiz) return res.status(404).send('Quiz not found');

        const existingQuestion = await prisma.question.findUnique({
            where: { id: parseInt(id) },
            include: { answers: true }
        });
        if (!existingQuestion) return res.status(404).send('Question not found');

        if (!question || !answer1 || !answer2 || !answer3 || !answer4 || correctAnswer === undefined) {
            if (req.file) fs.unlinkSync(req.file.path);

            // UPDATE: Fetch kategori lagi jika form kembali dilempar karena error
            const categories = await prisma.category.findMany();
            return res.render('questions/edit', {
                quiz,
                categories,
                question: existingQuestion,
                error: 'All fields are required',
                path: 'quizzes'
            });
        }

        let imagePath = existingQuestion.image;
        if (req.file) {
            if (existingQuestion.image) {
                const oldPath = path.join(__dirname, '../../', existingQuestion.image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            imagePath = `/uploads/${req.file.filename}`;
        }

        // UPDATE: Update Question text, categoryId, and image
        await prisma.question.update({
            where: { id: parseInt(id) },
            data: {
                categoryId: categoryId ? parseInt(categoryId) : null, // UPDATE: Update Relasi
                question,
                image: imagePath,
                timer: parseInt(timer) || 15
            }
        });

        await prisma.answer.deleteMany({
            where: { questionId: parseInt(id) }
        });

        const answersData = [
            { questionId: parseInt(id), answerText: answer1, isCorrect: correctAnswer === '0' },
            { questionId: parseInt(id), answerText: answer2, isCorrect: correctAnswer === '1' },
            { questionId: parseInt(id), answerText: answer3, isCorrect: correctAnswer === '2' },
            { questionId: parseInt(id), answerText: answer4, isCorrect: correctAnswer === '3' }
        ];

        await prisma.answer.createMany({
            data: answersData
        });

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