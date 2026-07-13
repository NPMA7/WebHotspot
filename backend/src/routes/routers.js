const router    = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl      = require('../controllers/routerController');

router.get('/',            adminAuth, ctrl.getRouters);
router.get('/:id',         adminAuth, ctrl.getRouterById);
router.post('/',           adminAuth, ctrl.createRouter);
router.put('/:id',         adminAuth, ctrl.updateRouter);
router.delete('/:id',      adminAuth, ctrl.deleteRouter);
router.get('/:id/test',    adminAuth, ctrl.testConnection);

module.exports = router;
