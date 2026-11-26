const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use('/users', protect, requirePermission('user.manage'));

router.get('/users', userController.listUsers);
router.get('/users/create', userController.getCreateUser);
router.post('/users/create', userController.postCreateUser);
router.get('/users/edit/:id', userController.getEditUser);
router.post('/users/edit/:id', userController.postEditUser);
router.post('/users/delete/:id', userController.deleteUser);

module.exports = router;
