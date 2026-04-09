const coldStorageService = require('../services/coldStorage.service');
const translationService = require('../../services/translation.service');
const prisma = require('../../config/prisma'); // ✅ FIXED: was ../../config/database

// Maps frontend lang codes → DB enum values (same pattern as weather)
const langCodeMap = { 'en': 'ENGLISH', 'hi': 'HINDI', 'bn': 'BENGALI' };

class ColdStorageController {

  async findNearby(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { harvestId, radius, limit } = req.query;

      if (!harvestId) {
        return res.status(400).json({ success: false, message: 'harvestId is required' });
      }

      const radiusKm = radius ? parseInt(radius) : 50;
      const limitResults = limit ? parseInt(limit) : 6;

      const result = await coldStorageService.findNearbyColdStorages(
        harvestId, farmerId, radiusKm, limitResults
      );

      // ✅ FIXED: use req.farmer.preferredLanguage (already fetched by auth middleware)
      // Override with ?lang= query param if farmer changed language locally
      const queryLang = req.query.lang ? langCodeMap[req.query.lang] : null;
      const language = queryLang || req.farmer.preferredLanguage || 'ENGLISH';

      const translations = {
        BENGALI: { registered: 'পশ্চিমবঙ্গ সরকার নিবন্ধিত', km: 'km', state: 'পশ্চিমবঙ্গ' },
        HINDI:   { registered: 'पश्चिम बंगाल सरकार पंजीकृत', km: 'km', state: 'पश्चिम बंगाल' },
        ENGLISH: { registered: 'West Bengal Govt Registered', km: 'km', state: 'West Bengal' }
      };
      const t = translations[language];

      if (language === 'BENGALI') {
        for (let cs of result.coldStorages) {
          cs.name = cs.nameBn || cs.name;
          cs.registeredUnder = t.registered;
          cs.state = t.state;
          cs.distanceFormatted = `${cs.distance} ${t.km}`;
          cs.storedCrops = cs.storedCrops.map(crop => crop.nameBn);
          delete cs.nameBn; delete cs.nameHi;
        }
        result.harvest.cropName = result.harvest.cropNameBn || result.harvest.cropName;

      } else if (language === 'HINDI') {
        for (let cs of result.coldStorages) {
          cs.name = cs.nameHi || cs.name;
          cs.registeredUnder = t.registered;
          cs.state = t.state;
          cs.distanceFormatted = `${cs.distance} ${t.km}`;
          cs.storedCrops = cs.storedCrops.map(crop => crop.nameHi);
          delete cs.nameBn; delete cs.nameHi;
        }
        result.harvest.cropName = result.harvest.cropNameHi || result.harvest.cropName;

      } else {
        for (let cs of result.coldStorages) {
          cs.registeredUnder = t.registered;
          cs.storedCrops = cs.storedCrops.map(crop => crop.nameEn);
          delete cs.nameBn; delete cs.nameHi;
        }
      }

      delete result.harvest.cropNameEn;
      delete result.harvest.cropNameHi;
      delete result.harvest.cropNameBn;

      return res.status(200).json({
        success: true,
        message: result.coldStorages.length > 0
          ? `Found ${result.totalFound} cold storage facilities nearby`
          : 'No cold storages found in your area for this crop',
        harvestDetails: result.harvest,
        coldStorages: result.coldStorages,
        searchRadius: `${result.searchRadius} ${t.km}`
      });

    } catch (error) {
      console.error('Find Nearby Cold Storages Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to find nearby cold storages' });
    }
  }

  async getDetails(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { id } = req.params;

      const result = await coldStorageService.getColdStorageDetails(id, farmerId);

      // ✅ FIXED: use req.farmer.preferredLanguage + query param override
      const queryLang = req.query.lang ? langCodeMap[req.query.lang] : null;
      const language = queryLang || req.farmer.preferredLanguage || 'ENGLISH';

      const translations = {
        BENGALI: { registered: 'পশ্চিমবঙ্গ সরকার নিবন্ধিত', km: 'km', state: 'পশ্চিমবঙ্গ' },
        HINDI:   { registered: 'पश्चिम बंगाल सरकार पंजीकृत', km: 'km', state: 'पश्चिम बंगाल' },
        ENGLISH: { registered: 'West Bengal Govt Registered', km: 'km', state: 'West Bengal' }
      };
      const t = translations[language];

      if (language === 'BENGALI') {
        result.coldStorage.name = result.coldStorage.nameBn || result.coldStorage.name;
        result.coldStorage.registeredUnder = t.registered;
        result.coldStorage.state = t.state;
        result.coldStorage.storedCrops = result.coldStorage.storedCrops.map(crop => ({
          id: crop.id, name: crop.nameBn
        }));
        delete result.coldStorage.nameBn; delete result.coldStorage.nameHi;

      } else if (language === 'HINDI') {
        result.coldStorage.name = result.coldStorage.nameHi || result.coldStorage.name;
        result.coldStorage.registeredUnder = t.registered;
        result.coldStorage.state = t.state;
        result.coldStorage.storedCrops = result.coldStorage.storedCrops.map(crop => ({
          id: crop.id, name: crop.nameHi
        }));
        delete result.coldStorage.nameBn; delete result.coldStorage.nameHi;

      } else {
        result.coldStorage.registeredUnder = t.registered;
        result.coldStorage.storedCrops = result.coldStorage.storedCrops.map(crop => ({
          id: crop.id, name: crop.nameEn
        }));
        delete result.coldStorage.nameBn; delete result.coldStorage.nameHi;
      }

      return res.status(200).json({
        success: true,
        coldStorage: result.coldStorage,
        farmerLocation: result.farmerLocation
      });

    } catch (error) {
      console.error('Get Cold Storage Details Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get cold storage details' });
    }
  }

  async getDirections(req, res) {
    try {
      const farmerId = req.farmer.id;
      const { id } = req.params;

      const result = await coldStorageService.getDirections(id, farmerId);

      const queryLang = req.query.lang ? langCodeMap[req.query.lang] : null;
      const language = queryLang || req.farmer.preferredLanguage || 'ENGLISH';

      if (language === 'BENGALI') {
        result.destination.name = result.destination.nameBn || result.destination.name;
      } else if (language === 'HINDI') {
        result.destination.name = result.destination.nameHi || result.destination.name;
      }

      delete result.destination.nameBn; delete result.destination.nameHi;

      return res.status(200).json({ success: true, ...result });

    } catch (error) {
      console.error('Get Directions Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to get directions' });
    }
  }

  async search(req, res) {
    try {
      const { district, state, cropId } = req.query;
      const result = await coldStorageService.searchColdStorages(district, state, cropId);
      return res.status(200).json({ success: true, totalFound: result.totalFound, coldStorages: result.coldStorages });
    } catch (error) {
      console.error('Search Cold Storages Error:', error);
      return res.status(500).json({ success: false, message: error.message || 'Failed to search cold storages' });
    }
  }
}

module.exports = new ColdStorageController();
