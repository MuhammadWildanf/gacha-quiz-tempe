const express = require('express');
const router = express.Router();
const authApiController = require('../controllers/authApiController');

router.post('/auth/login', authApiController.postApiLogin);

module.exports = router;
