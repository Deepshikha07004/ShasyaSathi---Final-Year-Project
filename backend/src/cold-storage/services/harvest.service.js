const prisma = require('../../config/prisma');

class HarvestService {

  async getHarvestableCrops(farmerId) {
    try {
      const activeLocation = await prisma.farmerLocation.findFirst({
        where: { farmerId, isActive: true }
      });
      if (!activeLocation) throw new Error('No active location found');

      const growingCrops = await prisma.farmerCrop.findMany({
        where: { farmerId, locationId: activeLocation.id, status: 'GROWING' },
        include: {
          crop: {
            select: { id: true, cropNameEn: true, cropNameHi: true, cropNameBn: true, suitableClimate: true, growingDurationDays: true }
          }
        },
        orderBy: { sowingDate: 'asc' }
      });

      return {
        success: true,
        location: activeLocation,
        crops: growingCrops.map(fc => {
          const daysGrowing = Math.floor((new Date() - new Date(fc.sowingDate)) / (1000 * 60 * 60 * 24));
          return {
            farmerCropId: fc.id,
            cropId: fc.crop.id,
            cropNameEn: fc.crop.cropNameEn,
            cropNameHi: fc.crop.cropNameHi,
            cropNameBn: fc.crop.cropNameBn,
            sowingDate: fc.sowingDate,
            daysGrowing,
            expectedDuration: fc.crop.growingDurationDays,
            isReadyForHarvest: daysGrowing >= fc.crop.growingDurationDays
          };
        })
      };
    } catch (error) {
      console.error('❌ Get harvestable crops error:', error);
      throw error;
    }
  }

  async recordHarvest(farmerId, farmerCropId, quantity, notes) {
    try {
      const farmerCrop = await prisma.farmerCrop.findUnique({
        where: { id: farmerCropId },
        include: { crop: true, location: true }
      });

      if (!farmerCrop) throw new Error('Crop not found');
      if (farmerCrop.farmerId !== farmerId) throw new Error('Unauthorized: This crop does not belong to you');
      if (farmerCrop.status === 'HARVESTED') throw new Error('This crop has already been harvested');

      const harvestRecord = await prisma.harvestRecord.create({
        data: { farmerId, locationId: farmerCrop.locationId, farmerCropId, quantity, notes: notes || null, harvestDate: new Date() }
      });

      await prisma.farmerCrop.update({ where: { id: farmerCropId }, data: { status: 'HARVESTED' } });

      console.log(`✅ Harvest recorded: ${quantity}kg of ${farmerCrop.crop.cropNameEn}`);

      return {
        success: true,
        harvestRecord: { ...harvestRecord, cropName: farmerCrop.crop.cropNameEn, locationName: farmerCrop.location.locationName }
      };
    } catch (error) {
      console.error('❌ Record harvest error:', error);
      throw error;
    }
  }

  async getHarvestHistory(farmerId, locationId = null) {
    try {
      const where = { farmerId };
      if (locationId) where.locationId = locationId;

      const harvests = await prisma.harvestRecord.findMany({
        where,
        include: { farmerCrop: { include: { crop: true } }, location: true },
        orderBy: { harvestDate: 'desc' }
      });

      return {
        success: true,
        harvests: harvests.map(h => ({
          id: h.id,
          cropName: h.farmerCrop.crop.cropNameEn,
          quantity: h.quantity,
          harvestDate: h.harvestDate,
          locationName: h.location.locationName,
          notes: h.notes
        }))
      };
    } catch (error) {
      console.error('❌ Get harvest history error:', error);
      throw error;
    }
  }

  async getHarvestDetails(harvestId, farmerId) {
    try {
      const harvest = await prisma.harvestRecord.findUnique({
        where: { id: harvestId },
        include: { farmerCrop: { include: { crop: true } }, location: true }
      });

      if (!harvest) throw new Error('Harvest record not found');
      if (harvest.farmerId !== farmerId) throw new Error('Unauthorized access');

      return {
        success: true,
        harvest: {
          id: harvest.id,
          cropId: harvest.farmerCrop.crop.id,
          cropNameEn: harvest.farmerCrop.crop.cropNameEn,
          cropNameHi: harvest.farmerCrop.crop.cropNameHi,
          cropNameBn: harvest.farmerCrop.crop.cropNameBn,
          quantity: harvest.quantity,
          harvestDate: harvest.harvestDate,
          notes: harvest.notes,
          location: {
            id: harvest.location.id,
            name: harvest.location.locationName,
            latitude: harvest.location.latitude,
            longitude: harvest.location.longitude,
            city: harvest.location.city,
            state: harvest.location.state
          }
        }
      };
    } catch (error) {
      console.error('❌ Get harvest details error:', error);
      throw error;
    }
  }

  // ✅ NEW — farmer confirmed they found a cold storage, remove from their list
  async deleteHarvest(harvestId, farmerId) {
    try {
      const harvest = await prisma.harvestRecord.findUnique({ where: { id: harvestId } });

      if (!harvest) throw new Error('Harvest record not found');
      if (harvest.farmerId !== farmerId) throw new Error('Unauthorized: This harvest does not belong to you');

      await prisma.harvestRecord.delete({ where: { id: harvestId } });

      console.log(`✅ Harvest record ${harvestId} deleted — farmer found storage`);
      return { success: true };
    } catch (error) {
      console.error('❌ Delete harvest error:', error);
      throw error;
    }
  }
}

module.exports = new HarvestService();
