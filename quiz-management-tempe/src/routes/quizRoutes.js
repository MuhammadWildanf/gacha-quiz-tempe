const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', quizController.getQuizzes);
router.get('/create', quizController.getCreateQuiz);
router.post('/create', quizController.postCreateQuiz);
router.get('/edit/:id', quizController.getEditQuiz);
router.post('/edit/:id', quizController.postEditQuiz);
router.post('/delete/:id', quizController.deleteQuiz);

module.exports = router;
