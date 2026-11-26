const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use('/roles', protect, requirePermission('role.manage'));

router.get('/roles', roleController.getRoles);
router.post('/roles/:id', roleController.postRolePermissions);

module.exports = router;
