const express = require('express');
const router = express.Router();
const harvestController = require('../controllers/harvest.controller');
const { protect } = require('../../middleware/auth.middleware');

router.use(protect);

router.get('/available', harvestController.getAvailableCrops.bind(harvestController));
router.post('/record', harvestController.recordHarvest.bind(harvestController));
router.get('/history', harvestController.getHarvestHistory.bind(harvestController));

// ✅ NEW: mark harvest as stored (farmer found a cold storage)
router.delete('/:id', harvestController.deleteHarvest.bind(harvestController));

// keep specific routes before :id
router.get('/:id', harvestController.getHarvestDetails.bind(harvestController));

module.exports = router;