const express = require('express');
const router = express.Router();
const machineStockController = require('../controllers/machineStockController');
const { requireInternalKey } = require('../middleware/internalAuth');

router.get('/machines/:machineId/stock', requireInternalKey, machineStockController.getInternalStock);
router.post('/stock-events', requireInternalKey, machineStockController.postDispenseEvent);

module.exports = router;
