const prisma = require('../config/prisma');
const axios = require('axios');

class LocationService {

  // =====================================
  // REVERSE GEOCODING (Nominatim)
  //
  // IMPORTANT: This is now BEST-EFFORT.
  // If Nominatim is unavailable, misconfigured, or times out,
  // we return empty strings instead of throwing.
  // The location ALWAYS saves — lat/lon is what matters for weather/advisory.
  // Address fields will just be blank and can be populated later.
  // =====================================
  async reverseGeocode(latitude, longitude) {
    const empty = {
      fullAddress: "",
      village:     "",
      area:        "",
      district:    "",
      state:       "",
      pincode:     ""
    };

    if (!process.env.NOMINATIM_BASE_URL) {
      console.log("NOMINATIM_BASE_URL not set — skipping reverse geocode");
      return empty;
    }

    try {
      const response = await axios.get(
        `${process.env.NOMINATIM_BASE_URL}/reverse`,
        {
          params: {
            lat: latitude,
            lon: longitude,
            format: 'json',
            addressdetails: 1,
            'accept-language': 'en'
          },
          headers: {
            'User-Agent': process.env.NOMINATIM_USER_AGENT || 'KrishiSaathi-App'
          },
          timeout: 8000
        }
      );

      const addr = response.data.address || {};

      return {
        fullAddress: response.data.display_name || "",
        village:     addr.village || addr.hamlet || "",
        // ✅ FIXED: Check quarter and locality first — Nominatim returns
        // Indian localities like "Joka" as quarter/locality/suburb,
        // not as city/town. Priority: quarter > locality > neighbourhood
        // > suburb > city_district > city > town
        area:        addr.quarter || addr.locality || addr.neighbourhood ||
                     addr.suburb || addr.city_district || addr.city || addr.town || "",
        district:    addr.state_district || addr.county || "",
        state:       addr.state || "",
        pincode:     addr.postcode || ""
      };

    } catch (error) {
      console.log("Reverse geocode failed (non-fatal):", error.message);
      return empty;
    }
  }


  // =====================================
  // FORWARD GEOCODING — Multi-Strategy
  // =====================================
  async forwardGeocode(query) {
    if (!process.env.NOMINATIM_BASE_URL) {
      throw new Error("Geocoding service is not configured on this server.");
    }

    const axiosConfig = {
      headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'KrishiSaathi-App' },
      timeout: 12000
    };

    const baseParams = {
      format:          'json',
      addressdetails:  1,
      limit:           5,
      countrycodes:    'in',
      'accept-language': 'en'
    };

    // Convert Nominatim result → app's flat shape
    const formatResult = (r) => {
      const addr = r.address || {};
      return {
        displayName: r.display_name || "",
        latitude:    parseFloat(r.lat),
        longitude:   parseFloat(r.lon),
        fullAddress: r.display_name || "",
        village:     addr.village || addr.hamlet || addr.suburb || "",
        // ✅ FIXED: same priority order as reverseGeocode
        area:        addr.quarter || addr.locality || addr.neighbourhood ||
                     addr.suburb || addr.city_district || addr.city || addr.town || "",
        district:    addr.state_district || addr.county || addr.district || "",
        state:       addr.state || "",
        pincode:     addr.postcode || "",
        country:     addr.country || "India"
      };
    };

    const search = async (params) => {
      try {
        const res = await axios.get(
          `${process.env.NOMINATIM_BASE_URL}/search`,
          { params: { ...baseParams, ...params }, ...axiosConfig }
        );
        return (res.data || []).map(formatResult);
      } catch {
        return [];
      }
    };

    const parse = (raw) => {
      const pinMatch = raw.match(/\b(\d{6})\b/);
      const pincode  = pinMatch ? pinMatch[1] : null;

      let work = raw.replace(/\b\d{6}\b/, '').trim();

      const STATES = [
        'West Bengal','Maharashtra','Uttar Pradesh','Tamil Nadu','Karnataka',
        'Rajasthan','Gujarat','Madhya Pradesh','Bihar','Andhra Pradesh',
        'Telangana','Kerala','Odisha','Jharkhand','Assam','Punjab','Haryana',
        'Chhattisgarh','Uttarakhand','Himachal Pradesh','Goa','Tripura',
        'Meghalaya','Manipur','Nagaland','Arunachal Pradesh','Mizoram',
        'Sikkim','Delhi','Jammu and Kashmir','Ladakh'
      ];

      let state = "";
      for (const s of STATES) {
        const re = new RegExp(s, 'i');
        if (re.test(work)) {
          state = s;
          work  = work.replace(re, '').trim();
          break;
        }
      }

      const NOISE = /\b(near|opp|opposite|behind|beside|next\s+to|flat\s+no|house\s+no|plot\s+no|door\s+no|h\.no|s\.no|ward|block|sector|phase|gali|lane|road|rd|street|st|nagar|colony|society|apartment|apt|floor|building|bldg|complex|tower|residency|enclave|layout|extension|ext|circle|chowk|crossing|junction|main|by-pass|bypass|national\s+highway|nh|sh)\b\.?/gi;

      const cleanWork    = work.replace(NOISE, ' ').replace(/\s{2,}/g, ' ').trim();
      const tokens       = cleanWork.split(/[,\s]+/).filter(t => t.length > 2);
      const lastTwo      = tokens.slice(-2).join(', ');
      const lastThree    = tokens.slice(-3).join(', ');

      return { pincode, state, cleanWork, lastTwo, lastThree, tokens };
    };

    const { pincode, state, cleanWork, lastTwo, lastThree, tokens } = parse(query);

    const structuredParams = {};
    if (pincode)      structuredParams.postalcode = pincode;
    if (state)        structuredParams.state       = state;
    if (lastThree)    structuredParams.city        = lastThree;
    else if (lastTwo) structuredParams.city        = lastTwo;
    if (tokens.length > 3) {
      structuredParams.street = tokens.slice(0, Math.ceil(tokens.length / 2)).join(' ');
    }

    let results = await search(structuredParams);
    if (results.length > 0) return results;

    if (pincode) {
      results = await search({ q: `${pincode}${state ? ', ' + state : ''}` });
      if (results.length > 0) return results;
    }

    const cleanQuery = [cleanWork, state].filter(Boolean).join(', ');
    if (cleanQuery !== query) {
      results = await search({ q: cleanQuery });
      if (results.length > 0) return results;
    }

    const localityQuery = [lastThree || lastTwo, state].filter(Boolean).join(', ');
    if (localityQuery) {
      results = await search({ q: localityQuery });
      if (results.length > 0) return results;
    }

    results = await search({ q: query });
    if (results.length > 0) return results;

    throw new Error(
      "No location found. Try simplifying — e.g. 'Ballygunge, Kolkata, West Bengal' instead of the full street address."
    );
  }


  // =====================================
  // SHARED FORMATTER
  // =====================================
  _format(loc) {
    return {
      id:           loc.id,
      name:         loc.locationName,
      locationName: loc.locationName,
      latitude:     loc.latitude,
      longitude:    loc.longitude,
      address:      loc.address  || "",
      village:      loc.village  || "",
      area:         loc.area     || "",
      district:     loc.district || "",
      state:        loc.state    || "",
      pincode:      loc.pincode  || "",
      country:      "India",
      isActive:     loc.isActive,
      createdAt:    loc.createdAt
    };
  }


  // =====================================
  // ADD LOCATION
  // =====================================
  async addLocation(farmerId, latitude, longitude, locationName) {
    const addressData = await this.reverseGeocode(latitude, longitude);

    await prisma.farmerLocation.updateMany({
      where: { farmerId },
      data:  { isActive: false }
    });

    const location = await prisma.farmerLocation.create({
      data: {
        farmerId,
        locationName,
        latitude,
        longitude,
        address:  addressData.fullAddress,
        village:  addressData.village,
        area:     addressData.area,
        district: addressData.district,
        state:    addressData.state,
        pincode:  addressData.pincode,
        isActive: true
      }
    });

    return this._format(location);
  }


  // =====================================
  // GET ACTIVE LOCATION
  // =====================================
  async getActiveLocation(farmerId) {
    const location = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });
    if (!location) return null;
    return this._format(location);
  }


  // =====================================
  // GET ALL LOCATIONS
  // =====================================
  async getAllLocations(farmerId) {
    const locations = await prisma.farmerLocation.findMany({
      where:   { farmerId },
      orderBy: { createdAt: 'desc' }
    });
    return locations.map(loc => this._format(loc));
  }


  // =====================================
  // ACTIVATE LOCATION
  // =====================================
  async activateLocation(farmerId, locationId) {
    const existing = await prisma.farmerLocation.findFirst({
      where: { id: locationId, farmerId }
    });

    if (!existing) {
      throw new Error("Location not found or does not belong to this farmer.");
    }

    await prisma.farmerLocation.updateMany({
      where: { farmerId },
      data:  { isActive: false }
    });

    const location = await prisma.farmerLocation.update({
      where: { id: locationId },
      data:  { isActive: true }
    });

    return this._format(location);
  }

}

module.exports = new LocationService();
