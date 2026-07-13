const router = require('express').Router();
const { portalLogin, portalLogout } = require('../controllers/authController');

router.post('/login',  portalLogin);
router.post('/logout', portalLogout);

module.exports = router;
