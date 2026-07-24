const express = require('express');
const router  = express.Router();
const { getQueues, actionQueue } = require('../controllers/queueController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/:routerId', getQueues);
router.post('/:routerId/action', actionQueue);

module.exports = router;
