const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const gachaController = require('../controllers/gachaController');

const adminRouter = express.Router();
adminRouter.get('/gacha', protect, gachaController.getSettings);
adminRouter.post('/gacha', protect, gachaController.postSettings);

const apiRouter = express.Router();
apiRouter.get('/gacha/settings', gachaController.getApiSettings);
apiRouter.post('/gacha/log', gachaController.postLog);

module.exports = { adminRouter, apiRouter };
