const harvestService = require('../services/harvest.service');
const prisma = require('../../config/prisma');

class HarvestController {

  async getAvailableCrops(req, res) {
    try {
      const farmerId = req.farmer.id;
      const result = await harvestService.getHarvestableCrops(farmerId);

      const farmer = await prisma.farmer.findUnique({
        where: { id: farmerId },
        select: { preferredLanguage: true }
      });
      const language = farmer.preferredLanguage || 'ENGLISH';

      if (language !== 'ENGLISH') {
        result.crops = result.crops.map(crop => ({
          ...crop,
          cropName: language === 'HINDI' ? crop.cropNameHi :
                    language === 'BENGALI' ? crop.cropNameBn :
                    crop.cropNameEn
        }));
      } else {
        result.crops = result.crops.map(crop => ({ ...crop, cropName: crop.cropNameEn }));
      }

      return res.status(200).json({
        success: true,
        message: result.crops.length > 0 ? 'Crops available for harvest' : 'No crops ready for harvest at active location',
        location: { id: result.location.id, name: result.location.locationName, city: result.location.city },
        crops: result.crops
      });
    } catch (error) {
      console.error('Get Available Crops Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get harvestable crops' });
    }
  }

  async recordHarvest(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { farmerCropId, quantity, notes } = req.body;

      if (!farmerCropId || !quantity) {
        return res.status(400).json({ success: false, message: 'farmerCropId and quantity are required' });
      }
      if (quantity <= 0) {
        return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
      }

      const result = await harvestService.recordHarvest(farmerId, farmerCropId, parseFloat(quantity), notes);

      return res.status(201).json({ success: true, message: 'Harvest recorded successfully', harvest: result.harvestRecord });
    } catch (error) {
      console.error('Record Harvest Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to record harvest' });
    }
  }

  async getHarvestHistory(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { locationId } = req.query;
      const result = await harvestService.getHarvestHistory(farmerId, locationId);
      return res.status(200).json({ success: true, totalHarvests: result.harvests.length, harvests: result.harvests });
    } catch (error) {
      console.error('Get Harvest History Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get harvest history' });
    }
  }

  async getHarvestDetails(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { id } = req.params;
      const result = await harvestService.getHarvestDetails(id, farmerId);
      return res.status(200).json({ success: true, harvest: result.harvest });
    } catch (error) {
      console.error('Get Harvest Details Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get harvest details' });
    }
  }

  // ─── NEW: farmer found a cold storage — remove this harvest from their records ──
  async deleteHarvest(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { id } = req.params;

      await harvestService.deleteHarvest(id, farmerId);

      return res.status(200).json({
        success: true,
        message: 'Harvest record removed. Storage found!'
      });
    } catch (error) {
      console.error('Delete Harvest Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to remove harvest record' });
    }
  }
}

module.exports = new HarvestController();
