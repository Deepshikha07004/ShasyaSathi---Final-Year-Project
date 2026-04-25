const prisma = require('../config/prisma');
const { getMLCropRecommendation } = require('../services/ml.service');


// ============================================
// 🌱 GET Crop Recommendations (ML powered)
// GET /api/crops/recommendation
// ============================================
const getCropRecommendations = async (req, res) => {
  try {
    const farmerId = req.farmer.id;

    const activeLocation = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!activeLocation) {
      return res.status(400).json({ success: false, message: 'No active location found.' });
    }

    const activeCrop = await prisma.farmerCrop.findFirst({
      where: { farmerId, locationId: activeLocation.id, status: 'GROWING' }
    });

    if (activeCrop) {
      return res.status(200).json({
        success: true,
        mode: 'ACTIVE_CROP_EXISTS',
        message: 'You already have an active crop in this location.'
      });
    }

    const lat = activeLocation.latitude;
    const lon = activeLocation.longitude;

    if (!lat || !lon) {
      const mlResult = await getMLCropRecommendation(0, 0).catch(() => ({ success: false, allCrops: [] }));
      return res.status(200).json({
        success: true,
        mode: 'RECOMMENDATION',
        mlUsed: false,
        data: mlResult.allCrops || []
      });
    }

    const mlResult = await getMLCropRecommendation(lat, lon);

    if (!mlResult.success) {
      console.warn('ML recommendation failed, returning fallback list:', mlResult.error);
      return res.status(200).json({
        success: true,
        mode: 'RECOMMENDATION',
        mlUsed: false,
        mlError: mlResult.error,
        data: mlResult.allCrops || []
      });
    }

    const recommendedCrop = {
      ...mlResult.profile,
      isMLRecommended: true,
    };

    const otherCrops = (mlResult.allCrops || []).map(c => ({
      ...c,
      isMLRecommended: false,
    }));

    return res.status(200).json({
      success: true,
      mode: 'RECOMMENDATION',
      mlUsed: true,
      mlRecommendation: {
        cropName:    mlResult.cropName,
        confidence:  mlResult.confidence,
        weatherUsed: mlResult.weatherUsed,
      },
      data: [recommendedCrop, ...otherCrops]
    });

  } catch (error) {
    console.error('Crop Recommendation Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ============================================
// 🌾 SELECT Crop (Attach to Active Location)
// POST /api/crops/select
//
// Frontend sends the FULL ML profile:
//   cropName, cropNameHi, cropNameBn,
//   growingDurationDays, waterRequirement, suitableClimate
// OR just cropId for an already-saved DB row.
// ============================================
const selectCrop = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const {
      cropId,
      cropName,
      cropNameHi,
      cropNameBn,
      growingDurationDays,
      waterRequirement,
      suitableClimate
    } = req.body;

    if (!cropId && !cropName) {
      return res.status(400).json({ success: false, message: 'cropId or cropName is required' });
    }

    const activeLocation = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!activeLocation) {
      return res.status(400).json({ success: false, message: 'No active location found.' });
    }

    const existingActiveCrop = await prisma.farmerCrop.findFirst({
      where: { farmerId, locationId: activeLocation.id, status: 'GROWING' }
    });

    if (existingActiveCrop) {
      return res.status(400).json({ success: false, message: 'You already have an active crop in this location.' });
    }

    let crop;

    if (cropId) {
      // Direct DB lookup by ID
      crop = await prisma.cropMaster.findUnique({ where: { id: cropId } });
      if (!crop) return res.status(404).json({ success: false, message: 'Crop not found' });
    } else {
      // ML path — find existing or create with FULL profile from knowledge base
      crop = await prisma.cropMaster.findFirst({
        where: { cropNameEn: { equals: cropName, mode: 'insensitive' } }
      });

      if (!crop) {
        // Create with correct Hindi/Bengali names from ML knowledge base
        crop = await prisma.cropMaster.create({
          data: {
            cropNameEn:          cropName,
            cropNameHi:          cropNameHi || cropName,   // ✅ real Hindi name from knowledge base
            cropNameBn:          cropNameBn || cropName,   // ✅ real Bengali name from knowledge base
            growingDurationDays: growingDurationDays || 120,
            waterRequirement:    waterRequirement    || 'MEDIUM',
            suitableClimate:     suitableClimate     || 'ALL_SEASON',
          }
        });
      } else {
        // Crop row exists — update if names are still English placeholders
        const needsUpdate =
          (cropNameHi && crop.cropNameHi === crop.cropNameEn) ||  // Hi still has English
          (cropNameBn && crop.cropNameBn === crop.cropNameEn) ||  // Bn still has English
          (growingDurationDays && crop.growingDurationDays !== growingDurationDays);

        if (needsUpdate) {
          crop = await prisma.cropMaster.update({
            where: { id: crop.id },
            data: {
              cropNameHi:          cropNameHi          || crop.cropNameHi,
              cropNameBn:          cropNameBn          || crop.cropNameBn,
              growingDurationDays: growingDurationDays || crop.growingDurationDays,
              waterRequirement:    waterRequirement    || crop.waterRequirement,
              suitableClimate:     suitableClimate     || crop.suitableClimate,
            }
          });
        }
      }
    }

    const newFarmerCrop = await prisma.farmerCrop.create({
      data: {
        farmerId,
        locationId: activeLocation.id,
        cropId:     crop.id,
        sowingDate: new Date(),
        status:     'GROWING'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Crop selected successfully',
      data: {
        farmerCropId: newFarmerCrop.id,
        location:     activeLocation.locationName,
        cropDetails:  crop
      }
    });

  } catch (error) {
    console.error('Select Crop Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ============================================
// 🌾 GET Active Crop for Active Location
// GET /api/crops/active
// ============================================
const getActiveCrop = async (req, res) => {
  try {
    const farmerId = req.farmer.id;

    const activeLocation = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!activeLocation) {
      return res.status(400).json({ success: false, message: 'No active location found.' });
    }

    const activeCrop = await prisma.farmerCrop.findFirst({
      where: { farmerId, locationId: activeLocation.id, status: 'GROWING' },
      include: { crop: true }
    });

    if (!activeCrop) {
      return res.status(404).json({ success: false, message: 'No active crop found in this location.' });
    }

    const totalDuration = activeCrop.crop.growingDurationDays;
    if (!totalDuration || totalDuration <= 0) {
      return res.status(500).json({ success: false, message: 'Crop duration data is missing.' });
    }

    // Calendar-date-only progress calculation (avoids timezone off-by-one)
    const sowingDate     = new Date(activeCrop.sowingDate);
    const sowingDateOnly = new Date(sowingDate.getFullYear(), sowingDate.getMonth(), sowingDate.getDate());
    const today          = new Date();
    const todayOnly      = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const rawDaysPassed   = Math.floor((todayOnly - sowingDateOnly) / (1000 * 60 * 60 * 24));
    const daysPassed      = Math.max(0, rawDaysPassed);
    const daysLeft        = Math.max(0, totalDuration - daysPassed);
    const progressPercent = Math.min(100, Math.round((daysPassed / totalDuration) * 100));
    const status          = rawDaysPassed < 0 ? 'Not Started'
                          : daysPassed < totalDuration ? 'Growing' : 'Completed';

    return res.status(200).json({
      success: true,
      data: {
        location:         activeLocation.locationName,
        cropName:         activeCrop.crop.cropNameEn,
        sowingDate:       activeCrop.sowingDate,
        totalDuration,
        daysPassed,
        daysLeft,
        progressPercent,
        status,
        waterRequirement: activeCrop.crop.waterRequirement,
        climate:          activeCrop.crop.suitableClimate,
      }
    });

  } catch (error) {
    console.error('Active Crop Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ============================================
// 🌱 SAVE ADVISORY CROP
// POST /api/crops/save-advisory
// ============================================
const saveAdvisoryCrop = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const { cropName, sowingDate } = req.body;

    if (!cropName) {
      return res.status(400).json({ success: false, message: 'cropName is required' });
    }

    const activeLocation = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!activeLocation) {
      return res.status(400).json({ success: false, message: 'No active location found.' });
    }

    const existingCrop = await prisma.farmerCrop.findFirst({
      where: { farmerId, locationId: activeLocation.id, status: 'GROWING' }
    });

    if (existingCrop) {
      return res.status(200).json({ success: true, message: 'Active crop already exists.', alreadyExists: true });
    }

    let crop = await prisma.cropMaster.findFirst({
      where: { cropNameEn: { equals: cropName, mode: 'insensitive' } }
    });

    if (!crop) {
      crop = await prisma.cropMaster.create({
        data: {
          cropNameEn:          cropName,
          cropNameHi:          cropName,
          cropNameBn:          cropName,
          waterRequirement:    'MEDIUM',
          suitableClimate:     'ALL_SEASON',
          growingDurationDays: 90,
        }
      });
    }

    let validSowingDate = new Date();
    if (sowingDate) {
      const parsed = new Date(sowingDate);
      if (!isNaN(parsed.getTime())) validSowingDate = parsed;
    }

    const newFarmerCrop = await prisma.farmerCrop.create({
      data: {
        farmerId,
        locationId: activeLocation.id,
        cropId:     crop.id,
        sowingDate: validSowingDate,
        status:     'GROWING'
      }
    });

    const session = await prisma.farmerSession.findFirst({ where: { farmerId } });
    if (session) {
      await prisma.farmerSession.update({
        where: { id: session.id },
        data: { intakeStep: null, intakeData: {} }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Crop saved successfully',
      data: {
        farmerCropId: newFarmerCrop.id,
        cropName:     crop.cropNameEn,
        location:     activeLocation.locationName,
      }
    });

  } catch (error) {
    console.error('Save Advisory Crop Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


// ============================================
// 🔄 END Active Crop
// PATCH /api/crops/end
// ============================================
const endActiveCrop = async (req, res) => {
  try {
    const farmerId = req.farmer.id;

    const activeLocation = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!activeLocation) {
      return res.status(400).json({ success: false, message: 'No active location found.' });
    }

    const activeCrop = await prisma.farmerCrop.findFirst({
      where: { farmerId, locationId: activeLocation.id, status: 'GROWING' }
    });

    if (!activeCrop) {
      return res.status(404).json({ success: false, message: 'No active crop found.' });
    }

    await prisma.farmerCrop.update({
      where: { id: activeCrop.id },
      data:  { status: 'HARVESTED' }
    });

    return res.status(200).json({ success: true, message: 'Crop ended. You can now start a new crop.' });

  } catch (error) {
    console.error('End Crop Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


module.exports = { getCropRecommendations, selectCrop, getActiveCrop, endActiveCrop, saveAdvisoryCrop };