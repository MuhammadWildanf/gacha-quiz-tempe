const express = require('express');
const { protect, requirePermission } = require('../middleware/authMiddleware');
const boothController = require('../controllers/boothController');
const boothApiController = require('../controllers/boothApiController');

const manage = [protect, requirePermission('booth.manage')];

const adminRouter = express.Router();
adminRouter.get('/booths', ...manage, boothController.getBooths);
adminRouter.get('/booths/create', ...manage, boothController.getCreateBooth);
adminRouter.post('/booths/create', ...manage, boothController.postCreateBooth);
adminRouter.get('/booths/edit/:id', ...manage, boothController.getEditBooth);
adminRouter.post('/booths/edit/:id', ...manage, boothController.postEditBooth);
adminRouter.post('/booths/delete/:id', ...manage, boothController.deleteBooth);

const apiRouter = express.Router();
apiRouter.get('/booths', boothApiController.getActiveBooths);
apiRouter.get('/stats/booth/:id', boothApiController.getBoothStats);

module.exports = { adminRouter, apiRouter };
