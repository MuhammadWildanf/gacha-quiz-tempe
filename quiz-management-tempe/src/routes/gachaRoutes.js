const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const gachaController = require('../controllers/gachaController');

const adminRouter = express.Router();
adminRouter.get('/gacha', protect, requirePermission('gacha.settings'), gachaController.getSettings);

const apiRouter = express.Router();
apiRouter.post('/gacha/log', gachaController.postLog);

module.exports = { adminRouter, apiRouter };
