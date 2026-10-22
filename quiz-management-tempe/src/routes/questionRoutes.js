const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const questionController = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Configure Multer for local uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Routing mapping
router.get('/:quizId/questions', questionController.getQuestions);
router.get('/:quizId/questions/create', questionController.getCreateQuestion);
router.post('/:quizId/questions/create', upload.single('image'), questionController.postCreateQuestion);
router.get('/:quizId/questions/edit/:id', questionController.getEditQuestion);
router.post('/:quizId/questions/edit/:id', upload.single('image'), questionController.postEditQuestion);
router.post('/:quizId/questions/delete/:id', questionController.deleteQuestion);

module.exports = router;
