const express = require('express');
const router = express.Router();
const machineStockController = require('../controllers/machineStockController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use('/machines', protect, requirePermission('stock.update'));

router.get('/machines', machineStockController.getMachines);
router.post('/machines/:machineId/stock', machineStockController.postManualStock);

module.exports = router;
