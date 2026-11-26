const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use('/audit-logs', protect, requirePermission('audit.view'));

router.get('/audit-logs', auditController.getAuditLogs);

module.exports = router;
