/**
 * ml.service.js
 *
 * CONFIRMED working ML /predict field names (reached 500, not 422):
 *   N, P, K, temperature, humidity, ph, rainfall
 *   (N P K uppercase, everything else lowercase)
 *
 * 500 "Model not loaded" = Render deployment issue on ML teammate's side.
 * Our field names are correct. App uses fallback list until ML is fixed.
 *
 * Returns: confidence scores { "rice": 0.87, "wheat": 0.03, ... }
 */

const axios = require('axios');

const ML_PREDICT_URL = 'https://fantastic-pancake-zdie.onrender.com/predict';

// ─── Season helper ────────────────────────────────────────────────────────────
const getCurrentSeason = () => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'SUMMER';
  if (month >= 5 && month <= 8) return 'MONSOON';
  return 'WINTER';
};

// ─── Crop knowledge base ──────────────────────────────────────────────────────
const CROP_PROFILES = {
  rice:        { cropNameEn: 'Rice',         cropNameHi: 'चावल',      cropNameBn: 'ধান',         growingDurationDays: 120, waterRequirement: 'HIGH',   suitableClimate: 'MONSOON'    },
  wheat:       { cropNameEn: 'Wheat',        cropNameHi: 'गेहूं',      cropNameBn: 'গম',          growingDurationDays: 120, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER'     },
  maize:       { cropNameEn: 'Maize',        cropNameHi: 'मक्का',      cropNameBn: 'ভুট্টা',      growingDurationDays: 90,  waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER'     },
  corn:        { cropNameEn: 'Maize',        cropNameHi: 'मक्का',      cropNameBn: 'ভুট্টা',      growingDurationDays: 90,  waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER'     },
  chickpea:    { cropNameEn: 'Chickpea',     cropNameHi: 'चना',        cropNameBn: 'ছোলা',        growingDurationDays: 100, waterRequirement: 'LOW',    suitableClimate: 'WINTER'     },
  kidneybeans: { cropNameEn: 'Kidney Beans', cropNameHi: 'राजमा',      cropNameBn: 'কিডনি বিনস', growingDurationDays: 90,  waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON' },
  pigeonpeas:  { cropNameEn: 'Pigeon Peas',  cropNameHi: 'अरहर',       cropNameBn: 'অড়হর',        growingDurationDays: 150, waterRequirement: 'LOW',    suitableClimate: 'MONSOON'    },
  mothbeans:   { cropNameEn: 'Moth Beans',   cropNameHi: 'मोठ',        cropNameBn: 'মোঠ বিনস',   growingDurationDays: 75,  waterRequirement: 'LOW',    suitableClimate: 'SUMMER'     },
  mungbean:    { cropNameEn: 'Mung Bean',    cropNameHi: 'मूंग',       cropNameBn: 'মুগ ডাল',    growingDurationDays: 65,  waterRequirement: 'LOW',    suitableClimate: 'SUMMER'     },
  blackgram:   { cropNameEn: 'Black Gram',   cropNameHi: 'उड़द',        cropNameBn: 'কালো ডাল',   growingDurationDays: 70,  waterRequirement: 'LOW',    suitableClimate: 'MONSOON'    },
  lentil:      { cropNameEn: 'Lentil',       cropNameHi: 'मसूर',       cropNameBn: 'মসুর ডাল',   growingDurationDays: 110, waterRequirement: 'LOW',    suitableClimate: 'WINTER'     },
  pomegranate: { cropNameEn: 'Pomegranate',  cropNameHi: 'अनार',       cropNameBn: 'ডালিম',       growingDurationDays: 180, waterRequirement: 'LOW',    suitableClimate: 'SUMMER'     },
  banana:      { cropNameEn: 'Banana',       cropNameHi: 'केला',       cropNameBn: 'কলা',         growingDurationDays: 300, waterRequirement: 'HIGH',   suitableClimate: 'ALL_SEASON' },
  mango:       { cropNameEn: 'Mango',        cropNameHi: 'आम',         cropNameBn: 'আম',          growingDurationDays: 120, waterRequirement: 'LOW',    suitableClimate: 'SUMMER'     },
  grapes:      { cropNameEn: 'Grapes',       cropNameHi: 'अंगूर',      cropNameBn: 'আঙুর',        growingDurationDays: 150, waterRequirement: 'LOW',    suitableClimate: 'SUMMER'     },
  watermelon:  { cropNameEn: 'Watermelon',   cropNameHi: 'तरबूज',      cropNameBn: 'তরমুজ',       growingDurationDays: 80,  waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER'     },
  muskmelon:   { cropNameEn: 'Muskmelon',    cropNameHi: 'खरबूजा',     cropNameBn: 'খরমুজ',       growingDurationDays: 75,  waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER'     },
  apple:       { cropNameEn: 'Apple',        cropNameHi: 'सेब',        cropNameBn: 'আপেল',        growingDurationDays: 150, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER'     },
  orange:      { cropNameEn: 'Orange',       cropNameHi: 'संतरा',      cropNameBn: 'কমলা',        growingDurationDays: 120, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER'     },
  papaya:      { cropNameEn: 'Papaya',       cropNameHi: 'पपीता',      cropNameBn: 'পেঁপে',       growingDurationDays: 270, waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON' },
  coconut:     { cropNameEn: 'Coconut',      cropNameHi: 'नारियल',     cropNameBn: 'নারকেল',      growingDurationDays: 365, waterRequirement: 'HIGH',   suitableClimate: 'ALL_SEASON' },
  cotton:      { cropNameEn: 'Cotton',       cropNameHi: 'कपास',       cropNameBn: 'তুলা',        growingDurationDays: 160, waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER'     },
  jute:        { cropNameEn: 'Jute',         cropNameHi: 'जूट',        cropNameBn: 'পাট',         growingDurationDays: 100, waterRequirement: 'HIGH',   suitableClimate: 'MONSOON'    },
  coffee:      { cropNameEn: 'Coffee',       cropNameHi: 'कॉफी',       cropNameBn: 'কফি',         growingDurationDays: 365, waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON' },
  potato:      { cropNameEn: 'Potato',       cropNameHi: 'आलू',        cropNameBn: 'আলু',         growingDurationDays: 90,  waterRequirement: 'MEDIUM', suitableClimate: 'WINTER'     },
  onion:       { cropNameEn: 'Onion',        cropNameHi: 'प्याज',      cropNameBn: 'পেঁয়াজ',     growingDurationDays: 120, waterRequirement: 'LOW',    suitableClimate: 'WINTER'     },
  tomato:      { cropNameEn: 'Tomato',       cropNameHi: 'टमाटर',      cropNameBn: 'টমেটো',       growingDurationDays: 75,  waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON' },
  sugarcane:   { cropNameEn: 'Sugarcane',    cropNameHi: 'गन्ना',       cropNameBn: 'আখ',          growingDurationDays: 365, waterRequirement: 'HIGH',   suitableClimate: 'ALL_SEASON' },
  soybean:     { cropNameEn: 'Soybean',      cropNameHi: 'सोयाबीन',    cropNameBn: 'সয়াবিন',     growingDurationDays: 100, waterRequirement: 'MEDIUM', suitableClimate: 'MONSOON'    },
  groundnut:   { cropNameEn: 'Groundnut',    cropNameHi: 'मूंगफली',    cropNameBn: 'বাদাম',       growingDurationDays: 120, waterRequirement: 'LOW',    suitableClimate: 'SUMMER'     },
};

const normalizeKey = (name) => name.toLowerCase().replace(/[\s_\-]+/g, '');

const getCropProfile = (mlCropName) => {
  if (!mlCropName) return null;
  return CROP_PROFILES[normalizeKey(mlCropName)] || null;
};

const getSeasonFilteredCrops = (excludeKey = null) => {
  const season = getCurrentSeason();
  return Object.entries(CROP_PROFILES)
    .filter(([key, profile]) => {
      if (excludeKey && key === excludeKey) return false;
      return profile.suitableClimate === season || profile.suitableClimate === 'ALL_SEASON';
    })
    .map(([, profile]) => profile)
    .filter((v, i, arr) => arr.findIndex(x => x.cropNameEn === v.cropNameEn) === i)
    .sort((a, b) => a.cropNameEn.localeCompare(b.cropNameEn));
};


// ─── Step 1: Fetch weather + soil from Open-Meteo ─────────────────────────────
const fetchOpenMeteoData = async (latitude, longitude) => {
  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'precipitation',
        'soil_moisture_0_to_1cm',
        'soil_moisture_1_to_3cm',
        'soil_temperature_0cm',
      ].join(','),
      forecast_days: 1,
    },
    timeout: 10000,
  });

  const c = response.data.current;

  const temperature   = c.temperature_2m;
  const humidity      = c.relative_humidity_2m;
  const rainfall      = c.precipitation          ?? 0;
  const soilMoisture  = c.soil_moisture_0_to_1cm ?? 0.2;
  const soilMoisture2 = c.soil_moisture_1_to_3cm ?? soilMoisture;
  const soilTemp      = c.soil_temperature_0cm    ?? temperature;

  const avgSoil = (soilMoisture + soilMoisture2) / 2;

  const N  = Math.round(Math.max(0,   Math.min(140, 40 + (avgSoil * 80)  + (Math.max(0, soilTemp - 15) * 0.5))));
  const P  = Math.round(Math.max(5,   Math.min(145, 30 + (Math.max(0, soilTemp - 10) * 1.2) + (avgSoil * 20))));
  const K  = Math.round(Math.max(5,   Math.min(205, 30 + (avgSoil * 40)  + (temperature * 0.3))));
  const ph = parseFloat(Math.max(4.5, Math.min(8.5, 6.5 - (avgSoil * 0.5) + (Math.max(0, temperature - 25) * 0.05))).toFixed(2));

  console.log(`📡 Weather — temp: ${temperature}°C | humidity: ${humidity}% | rainfall: ${rainfall}mm`);
  console.log(`🌍 Soil — N: ${N} | P: ${P} | K: ${K} | pH: ${ph}`);

  return { temperature, humidity, rainfall, N, P, K, ph };
};


// ─── Step 2: POST to ML /predict ─────────────────────────────────────────────
// Confirmed working fields (got 500 not 422, meaning schema was accepted):
//   N, P, K, temperature, humidity, ph, rainfall
const callMLPredict = async (weatherData) => {
  const payload = {
    N:           weatherData.N,
    P:           weatherData.P,
    K:           weatherData.K,
    temperature: weatherData.temperature,
    humidity:    weatherData.humidity,
    ph:          weatherData.ph,
    rainfall:    weatherData.rainfall,
  };

  console.log('🤖 Sending to ML:', JSON.stringify(payload));

  const response = await axios.post(ML_PREDICT_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  console.log('✅ ML response:', JSON.stringify(response.data));
  return response.data;
};


// ─── Step 3: Parse ML response ───────────────────────────────────────────────
const parsePrediction = (mlResponse) => {
  if (typeof mlResponse === 'string' && mlResponse.trim()) {
    return { cropName: mlResponse.trim(), confidence: null };
  }
  if (mlResponse.prediction)       return { cropName: mlResponse.prediction,       confidence: mlResponse.confidence ?? null };
  if (mlResponse.recommended_crop) return { cropName: mlResponse.recommended_crop, confidence: mlResponse.confidence ?? null };
  if (mlResponse.crop)             return { cropName: mlResponse.crop,             confidence: mlResponse.confidence ?? null };
  if (mlResponse.result)           return { cropName: mlResponse.result,           confidence: mlResponse.confidence ?? null };
  if (mlResponse.label)            return { cropName: mlResponse.label,            confidence: mlResponse.confidence ?? null };

  if (Array.isArray(mlResponse) && mlResponse.length > 0) {
    const sorted = [...mlResponse].sort(
      (a, b) => (b.score ?? b.confidence ?? 0) - (a.score ?? a.confidence ?? 0)
    );
    return {
      cropName:   sorted[0].crop ?? sorted[0].name ?? sorted[0].label,
      confidence: sorted[0].score ?? sorted[0].confidence ?? null,
    };
  }

  // Confidence scores object: { "rice": 0.87, "wheat": 0.03, ... }
  if (typeof mlResponse === 'object' && !Array.isArray(mlResponse)) {
    const entries = Object.entries(mlResponse).filter(([, v]) => typeof v === 'number');
    if (entries.length > 0) {
      const sorted = entries.sort(([, a], [, b]) => b - a);
      return { cropName: sorted[0][0], confidence: sorted[0][1] };
    }
  }

  console.error('Unknown ML response format:', JSON.stringify(mlResponse));
  return null;
};


// ─── Warm up ML model on backend start ───────────────────────────────────────
const warmUpMLModel = async () => {
  try {
    console.log('🔥 Warming up ML model...');
    await axios.get('https://fantastic-pancake-zdie.onrender.com/', { timeout: 35000 });
    console.log('✅ ML model is awake');
  } catch (e) {
    console.log('⚠️  ML warm-up failed (non-fatal):', e.message);
  }
};

warmUpMLModel();


// ─── Main export ──────────────────────────────────────────────────────────────
const getMLCropRecommendation = async (latitude, longitude) => {
  try {
    const weatherData = await fetchOpenMeteoData(latitude, longitude);
    const mlResponse  = await callMLPredict(weatherData);
    const prediction  = parsePrediction(mlResponse);

    if (!prediction || !prediction.cropName) {
      throw new Error('ML returned unrecognisable response format');
    }

    console.log(`🌾 ML recommended: "${prediction.cropName}" (confidence: ${prediction.confidence})`);

    const recommendedKey = normalizeKey(prediction.cropName);
    const profile        = getCropProfile(prediction.cropName);
    const allCropsList   = getSeasonFilteredCrops(recommendedKey);

    return {
      success:     true,
      cropName:    prediction.cropName,
      confidence:  prediction.confidence,
      profile: profile ?? {
        cropNameEn:          prediction.cropName,
        cropNameHi:          prediction.cropName,
        cropNameBn:          prediction.cropName,
        growingDurationDays: 120,
        waterRequirement:    'MEDIUM',
        suitableClimate:     getCurrentSeason() === 'WINTER'  ? 'WINTER'
                           : getCurrentSeason() === 'MONSOON' ? 'MONSOON' : 'SUMMER',
      },
      allCrops:    allCropsList,
      weatherUsed: weatherData,
      season:      getCurrentSeason(),
    };

  } catch (error) {
    console.error('ML Service Error:', error.message);
    return {
      success:  false,
      error:    error.message,
      allCrops: getSeasonFilteredCrops(),
      season:   getCurrentSeason(),
    };
  }
};


// ─── Advisory chatbot ─────────────────────────────────────────────────────────
const generateAdvisoryResponse = async (cropContext, history, userMessage) => {
  const { cropName, waterRequirement, climate, growingDuration } = cropContext;
  const msg = userMessage.toLowerCase();

  if (msg.includes('water') || msg.includes('irrigation') || msg.includes('पानी') || msg.includes('জল'))
    return `${cropName} requires ${waterRequirement} water. Irrigate based on soil moisture and current season conditions.`;
  if (msg.includes('harvest') || msg.includes('कटाई') || msg.includes('ফসল কাটা'))
    return `${cropName} typically takes ${growingDuration} days to harvest. Watch for maturity signs before cutting.`;
  if (msg.includes('pest') || msg.includes('insect') || msg.includes('bug') || msg.includes('कीट') || msg.includes('পোকা'))
    return `Inspect ${cropName} regularly for pest damage. Neem-based spray every 15 days works as a preventive measure.`;
  if (msg.includes('fertilizer') || msg.includes('fertiliser') || msg.includes('urea') || msg.includes('खाद') || msg.includes('সার'))
    return `For ${cropName} growing in ${climate} climate, apply balanced NPK fertilizer at recommended intervals. Avoid over-fertilizing.`;
  if (msg.includes('weather') || msg.includes('rain') || msg.includes('temperature') || msg.includes('मौसम') || msg.includes('আবহাওয়া'))
    return `${cropName} grows best in ${climate} conditions. Monitor weather forecasts and adjust irrigation accordingly.`;

  return `You are growing ${cropName}. Could you describe your issue in more detail so I can give you the best advice?`;
};


module.exports = { getMLCropRecommendation, generateAdvisoryResponse };
