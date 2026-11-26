const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const stockLogController = require('../controllers/stockLogController');

const adminRouter = express.Router();
adminRouter.get('/stock-logs', protect, requirePermission('stocklog.view'), stockLogController.getStockLogs);

const apiRouter = express.Router();
apiRouter.post('/stock-logs', protect, requirePermission('stock.update'), stockLogController.postStockLog);

module.exports = { adminRouter, apiRouter };
