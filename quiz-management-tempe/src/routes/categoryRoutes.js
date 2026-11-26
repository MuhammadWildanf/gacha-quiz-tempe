const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect, requirePermission } = require('../middleware/authMiddleware');

router.use('/categories', protect, requirePermission('category.manage'));

router.get('/categories', categoryController.listCategories);
router.get('/categories/create', categoryController.getCreateCategory);
router.post('/categories/create', categoryController.postCreateCategory);
router.get('/categories/edit/:id', categoryController.getEditCategory);
router.post('/categories/edit/:id', categoryController.postEditCategory);
router.post('/categories/delete/:id', categoryController.deleteCategory);

module.exports = router;
