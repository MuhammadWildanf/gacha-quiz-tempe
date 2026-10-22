const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.get('/quizzes', apiController.getActiveQuizzes);
router.get('/quiz', apiController.getActiveQuizForUnity);
router.get('/quizzes/:id', apiController.getQuizForUnity);
router.post('/quiz/answer', apiController.postAnswer);

module.exports = router;
