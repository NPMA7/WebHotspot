const router    = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl      = require('../controllers/dashboardController');

router.get('/summary',              adminAuth, ctrl.getSummary);
router.get('/:routerId/stats',      adminAuth, ctrl.getDashboardStats);
router.get('/:routerId/sessions',   adminAuth, ctrl.getActiveSessions);

module.exports = router;
