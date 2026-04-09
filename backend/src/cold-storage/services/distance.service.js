const { calculateDistance, formatDistance } = require('../utils/distanceCalculator');

class DistanceService {
  
  /**
   * Calculate distance between farmer location and cold storage
   */
  getDistance(farmerLat, farmerLon, storageLat, storageLon) {
    return calculateDistance(farmerLat, farmerLon, storageLat, storageLon);
  }

  /**
   * Sort cold storages by distance from farmer
   */
  sortByDistance(farmerLat, farmerLon, coldStorages) {
    return coldStorages
      .map(storage => {
        const distance = this.getDistance(
          farmerLat, 
          farmerLon, 
          storage.latitude, 
          storage.longitude
        );
        
        return {
          ...storage,
          distance: distance,
          distanceFormatted: formatDistance(distance) // ✅ Use already calculated distance
        };
      })
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Filter cold storages within radius (km)
   */
  filterByRadius(farmerLat, farmerLon, coldStorages, radiusKm = 50) {
    return coldStorages.filter(storage => {
      const distance = this.getDistance(
        farmerLat, 
        farmerLon, 
        storage.latitude, 
        storage.longitude
      );
      return distance <= radiusKm;
    });
  }
}

module.exports = new DistanceService();