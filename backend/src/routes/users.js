const router    = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const ctrl      = require('../controllers/userController');

// Import CSV harus sebelum /:id agar tidak konflik routing
router.post('/import-csv',      adminAuth, ...ctrl.importCSV);

router.get('/',                 adminAuth, ctrl.getUsers);
router.get('/:id',              adminAuth, ctrl.getUserById);
router.post('/',                adminAuth, ctrl.createUser);
router.put('/:id',              adminAuth, ctrl.updateUser);
router.delete('/:id',           adminAuth, ctrl.deleteUser);
router.put('/:id/bandwidth',    adminAuth, ctrl.updateBandwidth);
router.put('/:id/block',        adminAuth, ctrl.toggleWebsiteBlock);

module.exports = router;
