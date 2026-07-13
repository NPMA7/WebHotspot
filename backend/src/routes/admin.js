const router     = require('express').Router();
const adminAuth  = require('../middleware/adminAuth');
const { login, getProfile, changePassword } = require('../controllers/adminController');

router.post('/login',           login);
router.get('/profile',          adminAuth, getProfile);
router.put('/change-password',  adminAuth, changePassword);

module.exports = router;
