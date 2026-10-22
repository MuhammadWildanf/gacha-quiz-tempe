const prisma = require('../config/database');

// List Quizzes
const getQuizzes = async (req, res) => {
    try {
        const quizzes = await prisma.quiz.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { questions: true }
                }
            }
        });
        res.render('quizzes/index', { quizzes, path: 'quizzes' });
    } catch (error) {
        console.error('getQuizzes error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Create Form
const getCreateQuiz = (req, res) => {
    res.render('quizzes/create', { path: 'quizzes' });
};

// Save New Quiz
const postCreateQuiz = async (req, res) => {
    const { title, description, status } = req.body;

    try {
        if (!title) {
            return res.render('quizzes/create', {
                error: 'Title is required',
                path: 'quizzes'
            });
        }

        await prisma.quiz.create({
            data: {
                title,
                description,
                status: status === 'true' || status === true
            }
        });

        res.redirect('/admin/quizzes');
    } catch (error) {
        console.error('postCreateQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Edit Form
const getEditQuiz = async (req, res) => {
    const { id } = req.params;

    try {
        const quiz = await prisma.quiz.findUnique({
            where: { id: parseInt(id) }
        });

        if (!quiz) {
            return res.status(404).send('Quiz not found');
        }

        res.render('quizzes/edit', { quiz, path: 'quizzes' });
    } catch (error) {
        console.error('getEditQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Update Quiz
const postEditQuiz = async (req, res) => {
    const { id } = req.params;
    const { title, description, status } = req.body;

    try {
        if (!title) {
            const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(id) } });
            return res.render('quizzes/edit', {
                quiz,
                error: 'Title is required',
                path: 'quizzes'
            });
        }

        await prisma.quiz.update({
            where: { id: parseInt(id) },
            data: {
                title,
                description,
                status: status === 'true' || status === true
            }
        });

        res.redirect('/admin/quizzes');
    } catch (error) {
        console.error('postEditQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Delete Quiz
const deleteQuiz = async (req, res) => {
    const { id } = req.params;

    try {
        // Find if there are questions inside
        const questions = await prisma.question.findMany({
            where: { quizId: parseInt(id) }
        });

        // Delete questions and answers first
        for (const question of questions) {
            await prisma.answer.deleteMany({
                where: { questionId: question.id }
            });
        }

        await prisma.question.deleteMany({
            where: { quizId: parseInt(id) }
        });

        // Delete the quiz
        await prisma.quiz.delete({
            where: { id: parseInt(id) }
        });

        res.redirect('/admin/quizzes');
    } catch (error) {
        console.error('deleteQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

module.exports = {
    getQuizzes,
    getCreateQuiz,
    postCreateQuiz,
    getEditQuiz,
    postEditQuiz,
    deleteQuiz
};
