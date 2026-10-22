const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const boothController = require('../controllers/boothController');
const boothApiController = require('../controllers/boothApiController');

const adminRouter = express.Router();
adminRouter.get('/booths', protect, boothController.getBooths);
adminRouter.get('/booths/create', protect, boothController.getCreateBooth);
adminRouter.post('/booths/create', protect, boothController.postCreateBooth);
adminRouter.get('/booths/edit/:id', protect, boothController.getEditBooth);
adminRouter.post('/booths/edit/:id', protect, boothController.postEditBooth);
adminRouter.post('/booths/delete/:id', protect, boothController.deleteBooth);

const apiRouter = express.Router();
apiRouter.get('/booths', boothApiController.getActiveBooths);
apiRouter.get('/stats/booth/:id', boothApiController.getBoothStats);

module.exports = { adminRouter, apiRouter };
