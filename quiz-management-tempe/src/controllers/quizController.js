const path = require('path');
const fs = require('fs');
const { paginate, parsePage } = require('../helpers/pagination');
const prisma = require('../config/database');

const getQuizzes = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = parsePage(req);
        const offset = (page - 1) * limit;
        
        const [quizzes, total] = await Promise.all([
            prisma.quiz.findMany({
                orderBy: { createdAt: 'desc' },
                skip: offset,
                take: limit,
                include: { _count: { select: { questions: true } } }
            }),
            prisma.quiz.count()
        ]);

        const meta = paginate(total, page, limit);
        
        res.render('quizzes/index', {
            quizzes,
            path: 'quizzes',
            success: req.query.success || null,
            error: req.query.error || null,
            meta,
            filters: { page, limit }
        });
    } catch (error) {
        console.error('getQuizzes error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getCreateQuiz = (req, res) => {
    res.render('quizzes/create', { path: 'quizzes' });
};

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
            data: { title, description, status: status === 'true' || status === true }
        });

        res.redirect('/admin/quizzes?success=created');
    } catch (error) {
        console.error('postCreateQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getEditQuiz = async (req, res) => {
    const { id } = req.params;

    try {
        const quiz = await prisma.quiz.findUnique({ where: { id: parseInt(id) } });

        if (!quiz) {
            return res.status(404).send('Quiz not found');
        }

        res.render('quizzes/edit', { quiz, path: 'quizzes' });
    } catch (error) {
        console.error('getEditQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const postEditQuiz = async (req, res) => {
    const { id } = req.params;
    const { title, description, status } = req.body;

    try {
        const existing = await prisma.quiz.findUnique({ where: { id: parseInt(id) } });
        if (!existing) return res.status(404).send('Quiz not found');

        const finalTitle = (title && title.trim()) ? title.trim() : existing.title;

        await prisma.quiz.update({
            where: { id: parseInt(id) },
            data: {
                title: finalTitle,
                description: description !== undefined ? description.trim() : existing.description,
                status: status === 'true' || status === true
            }
        });

        res.redirect('/admin/quizzes?success=updated');
    } catch (error) {
        console.error('postEditQuiz error:', error);
        res.status(500).send('Internal Server Error');
    }
};

const deleteQuiz = async (req, res) => {
    const { id } = req.params;

    try {
        const questions = await prisma.question.findMany({ where: { quizId: parseInt(id) } });
        for (const question of questions) {
            if (question.image) {
                const filePath = path.join(__dirname, '../../', question.image);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
            await prisma.answer.deleteMany({ where: { questionId: question.id } });
        }
        await prisma.question.deleteMany({ where: { quizId: parseInt(id) } });
        await prisma.quiz.delete({ where: { id: parseInt(id) } });
        res.redirect('/admin/quizzes?success=deleted');
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