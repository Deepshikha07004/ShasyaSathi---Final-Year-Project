const prisma = require('../../config/prisma'); // ✅ FIXED: was ../../config/database
const distanceService = require('./distance.service');

class ColdStorageService {

  async findNearbyColdStorages(harvestId, farmerId, radiusKm = 50, limit = 6) {
    try {
      const harvest = await prisma.harvestRecord.findUnique({
        where: { id: harvestId },
        include: {
          farmerCrop: { include: { crop: true } },
          location: true
        }
      });

      if (!harvest) throw new Error('Harvest record not found');
      if (harvest.farmerId !== farmerId) throw new Error('Unauthorized access');

      const cropId = harvest.farmerCrop.crop.id;
      const farmerLat = harvest.location.latitude;
      const farmerLon = harvest.location.longitude;

      const coldStoragesWithCrop = await prisma.coldStorage.findMany({
        where: {
          isActive: true,
          storedCrops: { some: { cropId } }
        },
        include: {
          storedCrops: {
            include: {
              crop: {
                select: {
                  id: true,
                  cropNameEn: true,
                  cropNameHi: true,
                  cropNameBn: true
                }
              }
            }
          }
        }
      });

      const nearbyColdStorages = distanceService.filterByRadius(
        farmerLat, farmerLon, coldStoragesWithCrop, radiusKm
      );

      const sortedColdStorages = distanceService.sortByDistance(
        farmerLat, farmerLon, nearbyColdStorages
      );

      const limitedResults = sortedColdStorages.slice(0, limit);

      return {
        success: true,
        harvest: {
          cropName: harvest.farmerCrop.crop.cropNameEn,
          cropNameHi: harvest.farmerCrop.crop.cropNameHi,
          cropNameBn: harvest.farmerCrop.crop.cropNameBn,
          quantity: harvest.quantity,
          locationName: harvest.location.locationName
        },
        farmerLocation: { latitude: farmerLat, longitude: farmerLon },
        coldStorages: limitedResults.map(cs => ({
          id: cs.id,
          name: cs.name,
          nameBn: cs.nameBn,
          nameHi: cs.nameHi,
          distance: cs.distance,
          distanceFormatted: cs.distanceFormatted,
          district: cs.district,
          state: cs.state,
          storedCrops: cs.storedCrops.map(sc => ({
            nameEn: sc.crop.cropNameEn,
            nameHi: sc.crop.cropNameHi,
            nameBn: sc.crop.cropNameBn
          })),
          capacity: cs.capacity,
          coordinates: { latitude: cs.latitude, longitude: cs.longitude }
        })),
        totalFound: limitedResults.length,
        searchRadius: radiusKm
      };

    } catch (error) {
      console.error('❌ Find nearby cold storages error:', error);
      throw error;
    }
  }

  async getColdStorageDetails(coldStorageId, farmerId) {
    try {
      const coldStorage = await prisma.coldStorage.findUnique({
        where: { id: coldStorageId },
        include: {
          storedCrops: {
            include: {
              crop: {
                select: {
                  id: true,
                  cropNameEn: true,
                  cropNameHi: true,
                  cropNameBn: true
                }
              }
            }
          }
        }
      });

      if (!coldStorage) throw new Error('Cold storage not found');
      if (!coldStorage.isActive) throw new Error('This cold storage is currently inactive');

      const farmerLocation = await prisma.farmerLocation.findFirst({
        where: { farmerId, isActive: true }
      });

      let distance = null;
      let distanceFormatted = null;

      if (farmerLocation) {
        distance = distanceService.getDistance(
          farmerLocation.latitude, farmerLocation.longitude,
          coldStorage.latitude, coldStorage.longitude
        );
        distanceFormatted = require('../utils/distanceCalculator').formatDistance(distance);
      }

      return {
        success: true,
        coldStorage: {
          id: coldStorage.id,
          name: coldStorage.name,
          nameBn: coldStorage.nameBn,
          nameHi: coldStorage.nameHi,
          registeredUnder: coldStorage.registeredUnder,
          ownerContact: coldStorage.ownerContact,
          address: coldStorage.address,
          district: coldStorage.district,
          state: coldStorage.state,
          capacity: coldStorage.capacity,
          distance,
          distanceFormatted,
          storedCrops: coldStorage.storedCrops.map(sc => ({
            id: sc.crop.id,
            nameEn: sc.crop.cropNameEn,
            nameHi: sc.crop.cropNameHi,
            nameBn: sc.crop.cropNameBn
          })),
          coordinates: { latitude: coldStorage.latitude, longitude: coldStorage.longitude }
        },
        farmerLocation: farmerLocation
          ? { latitude: farmerLocation.latitude, longitude: farmerLocation.longitude }
          : null
      };

    } catch (error) {
      console.error('❌ Get cold storage details error:', error);
      throw error;
    }
  }

  async getDirections(coldStorageId, farmerId) {
    try {
      const coldStorage = await prisma.coldStorage.findUnique({
        where: { id: coldStorageId },
        select: { id: true, name: true, nameBn: true, nameHi: true, latitude: true, longitude: true, address: true }
      });

      if (!coldStorage) throw new Error('Cold storage not found');

      const farmerLocation = await prisma.farmerLocation.findFirst({
        where: { farmerId, isActive: true }
      });

      if (!farmerLocation) throw new Error('Farmer location not found');

      const distance = distanceService.getDistance(
        farmerLocation.latitude, farmerLocation.longitude,
        coldStorage.latitude, coldStorage.longitude
      );

      return {
        success: true,
        origin: {
          latitude: farmerLocation.latitude,
          longitude: farmerLocation.longitude,
          name: farmerLocation.locationName
        },
        destination: {
          latitude: coldStorage.latitude,
          longitude: coldStorage.longitude,
          name: coldStorage.name,
          nameBn: coldStorage.nameBn,
          nameHi: coldStorage.nameHi,
          address: coldStorage.address
        },
        distance,
        distanceFormatted: require('../utils/distanceCalculator').formatDistance(distance),
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${farmerLocation.latitude},${farmerLocation.longitude}&destination=${coldStorage.latitude},${coldStorage.longitude}&travelmode=driving`
      };

    } catch (error) {
      console.error('❌ Get directions error:', error);
      throw error;
    }
  }

  async searchColdStorages(district = null, state = null, cropId = null) {
    try {
      const where = { isActive: true };
      if (district) where.district = { contains: district, mode: 'insensitive' };
      if (state) where.state = { contains: state, mode: 'insensitive' };
      if (cropId) where.storedCrops = { some: { cropId } };

      const coldStorages = await prisma.coldStorage.findMany({
        where,
        include: {
          storedCrops: { include: { crop: { select: { cropNameEn: true } } } }
        },
        take: 20
      });

      return {
        success: true,
        coldStorages: coldStorages.map(cs => ({
          id: cs.id,
          name: cs.name,
          district: cs.district,
          state: cs.state,
          ownerContact: cs.ownerContact,
          storedCrops: cs.storedCrops.map(sc => sc.crop.cropNameEn)
        })),
        totalFound: coldStorages.length
      };

    } catch (error) {
      console.error('❌ Search cold storages error:', error);
      throw error;
    }
  }
}

module.exports = new ColdStorageService();
