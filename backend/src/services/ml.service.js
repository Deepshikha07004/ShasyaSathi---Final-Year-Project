/**
 * ml.service.js
 *
 * ROOT CAUSE OF MUSKMELON BIAS (fixed here):
 *
 * Problem 1 — rainfall was always 0:
 *   We were using `current.precipitation` which is mm in the LAST HOUR.
 *   At any given moment this is 0mm. The dataset mean rainfall is 103mm.
 *   Fix: Use 7-day sum of hourly precipitation from Open-Meteo hourly forecast.
 *
 * Problem 2 — P was too high (~54) vs muskmelon's P=18:
 *   Our formula was: P = 30 + (soilTemp-10)*1.2 + avgSoil*20
 *   This consistently gave P=50-60 which matches muskmelon/rice better.
 *   Fix: Recalibrated formula based on actual dataset mean P=53.
 *
 * Problem 3 — N was always ~71-77:
 *   Muskmelon N=100, rice N=80, jute N=78 — our N was closest to jute/rice/maize.
 *   But combined with humidity=89 and low rainfall, muskmelon won every time.
 *   Fix: Rainfall correction now pushes the model toward rice/jute for high-rain areas.
 */

const axios = require('axios');

const ML_PREDICT_URL = 'https://ridhibratadas-crop-recommendation-api.hf.space/predict';

// ─── Season helper ────────────────────────────────────────────────────────────
const getCurrentSeason = () => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'SUMMER';
  if (month >= 5 && month <= 8) return 'MONSOON';
  return 'WINTER';
};

// ─── Crop knowledge base ──────────────────────────────────────────────────────
// Weather thresholds are based on actual dataset values (analysed from CSV):
//   minHumidity/maxHumidity — what the crop's training data shows
//   minTemp/maxTemp         — °C tolerance
// These filter the fallback list by real Open-Meteo conditions.

const CROP_PROFILES = {
  rice: {
    cropNameEn: 'Rice', cropNameHi: 'चावल', cropNameBn: 'ধান',
    growingDurationDays: 120, waterRequirement: 'HIGH', suitableClimate: 'MONSOON',
    minHumidity: 60, maxHumidity: 100, minTemp: 18, maxTemp: 38,
  },
  wheat: {
    cropNameEn: 'Wheat', cropNameHi: 'गेहूं', cropNameBn: 'গম',
    growingDurationDays: 120, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',
    minHumidity: 30, maxHumidity: 75, minTemp: 10, maxTemp: 25,
  },
  maize: {
    cropNameEn: 'Maize', cropNameHi: 'मक्का', cropNameBn: 'ভুট্টা',
    growingDurationDays: 90, waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',
    minHumidity: 50, maxHumidity: 85, minTemp: 18, maxTemp: 38,
  },
  corn: {
    cropNameEn: 'Maize', cropNameHi: 'मक्का', cropNameBn: 'ভুট্টা',
    growingDurationDays: 90, waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',
    minHumidity: 50, maxHumidity: 85, minTemp: 18, maxTemp: 38,
  },
  chickpea: {
    cropNameEn: 'Chickpea', cropNameHi: 'चना', cropNameBn: 'ছোলা',
    growingDurationDays: 100, waterRequirement: 'LOW', suitableClimate: 'WINTER',
    // Dataset: humidity avg 17% — very dry crop
    minHumidity: 10, maxHumidity: 35, minTemp: 8, maxTemp: 28,
  },
  kidneybeans: {
    cropNameEn: 'Kidney Beans', cropNameHi: 'राजमा', cropNameBn: 'কিডনি বিনস',
    growingDurationDays: 90, waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON',
    // Dataset: humidity avg 22% — dry crop
    minHumidity: 10, maxHumidity: 40, minTemp: 15, maxTemp: 32,
  },
  pigeonpeas: {
    cropNameEn: 'Pigeon Peas', cropNameHi: 'अरहर', cropNameBn: 'অড়হর',
    growingDurationDays: 150, waterRequirement: 'LOW', suitableClimate: 'MONSOON',
    // Dataset: humidity avg 48%
    minHumidity: 35, maxHumidity: 65, minTemp: 20, maxTemp: 38,
  },
  mothbeans: {
    cropNameEn: 'Moth Beans', cropNameHi: 'मोठ', cropNameBn: 'মোঠ বিনস',
    growingDurationDays: 75, waterRequirement: 'LOW', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 53% — dry/arid crop
    minHumidity: 35, maxHumidity: 65, minTemp: 25, maxTemp: 42,
  },
  mungbean: {
    cropNameEn: 'Mung Bean', cropNameHi: 'मूंग', cropNameBn: 'মুগ ডাল',
    growingDurationDays: 65, waterRequirement: 'LOW', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 85%
    minHumidity: 65, maxHumidity: 100, minTemp: 25, maxTemp: 40,
  },
  blackgram: {
    cropNameEn: 'Black Gram', cropNameHi: 'उड़द', cropNameBn: 'কালো ডাল',
    growingDurationDays: 70, waterRequirement: 'LOW', suitableClimate: 'MONSOON',
    // Dataset: humidity avg 65%
    minHumidity: 50, maxHumidity: 80, minTemp: 22, maxTemp: 40,
  },
  lentil: {
    cropNameEn: 'Lentil', cropNameHi: 'मसूर', cropNameBn: 'মসুর ডাল',
    growingDurationDays: 110, waterRequirement: 'LOW', suitableClimate: 'WINTER',
    // Dataset: humidity avg 65%
    minHumidity: 45, maxHumidity: 80, minTemp: 10, maxTemp: 25,
  },
  pomegranate: {
    cropNameEn: 'Pomegranate', cropNameHi: 'अनार', cropNameBn: 'ডালিম',
    growingDurationDays: 180, waterRequirement: 'LOW', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 90% — dataset says humid but agronomically needs dry
    // Using dataset value to match what ML learned
    minHumidity: 70, maxHumidity: 100, minTemp: 18, maxTemp: 38,
  },
  banana: {
    cropNameEn: 'Banana', cropNameHi: 'केला', cropNameBn: 'কলা',
    growingDurationDays: 300, waterRequirement: 'HIGH', suitableClimate: 'ALL_SEASON',
    // Dataset: humidity avg 80%
    minHumidity: 65, maxHumidity: 100, minTemp: 20, maxTemp: 38,
  },
  mango: {
    cropNameEn: 'Mango', cropNameHi: 'आम', cropNameBn: 'আম',
    growingDurationDays: 120, waterRequirement: 'LOW', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 50%
    minHumidity: 35, maxHumidity: 68, minTemp: 24, maxTemp: 42,
  },
  grapes: {
    cropNameEn: 'Grapes', cropNameHi: 'अंगूर', cropNameBn: 'আঙুর',
    growingDurationDays: 150, waterRequirement: 'LOW', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 82% but agronomically needs dry — NOT for Bengal plains
    minHumidity: 20, maxHumidity: 65, minTemp: 15, maxTemp: 38,
  },
  watermelon: {
    cropNameEn: 'Watermelon', cropNameHi: 'तरबूज', cropNameBn: 'তরমুজ',
    growingDurationDays: 80, waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 85%
    minHumidity: 65, maxHumidity: 100, minTemp: 22, maxTemp: 40,
  },
  muskmelon: {
    cropNameEn: 'Muskmelon', cropNameHi: 'खरबूजा', cropNameBn: 'খরমুজ',
    growingDurationDays: 75, waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 92%
    minHumidity: 70, maxHumidity: 100, minTemp: 22, maxTemp: 40,
  },
  apple: {
    cropNameEn: 'Apple', cropNameHi: 'सेब', cropNameBn: 'আপেল',
    growingDurationDays: 150, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',
    // Dataset: humidity avg 92% but needs cool climate
    minHumidity: 70, maxHumidity: 100, minTemp: 5, maxTemp: 20,
  },
  orange: {
    cropNameEn: 'Orange', cropNameHi: 'संतरा', cropNameBn: 'কমলা',
    growingDurationDays: 120, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',
    minHumidity: 35, maxHumidity: 80, minTemp: 12, maxTemp: 30,
  },
  papaya: {
    cropNameEn: 'Papaya', cropNameHi: 'पपीता', cropNameBn: 'পেঁপে',
    growingDurationDays: 270, waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON',
    // Dataset: humidity avg 92%
    minHumidity: 70, maxHumidity: 100, minTemp: 20, maxTemp: 40,
  },
  coconut: {
    cropNameEn: 'Coconut', cropNameHi: 'नारियल', cropNameBn: 'নারকেল',
    growingDurationDays: 365, waterRequirement: 'HIGH', suitableClimate: 'ALL_SEASON',
    // Dataset: humidity avg 95%
    minHumidity: 75, maxHumidity: 100, minTemp: 20, maxTemp: 38,
  },
  cotton: {
    cropNameEn: 'Cotton', cropNameHi: 'कपास', cropNameBn: 'তুলা',
    growingDurationDays: 160, waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',
    // Dataset: humidity avg 80% — but agronomically Deccan/Punjab crop
    // Keeping agronomic threshold to prevent showing in Bengal
    minHumidity: 20, maxHumidity: 68, minTemp: 22, maxTemp: 42,
  },
  jute: {
    cropNameEn: 'Jute', cropNameHi: 'जूट', cropNameBn: 'পাট',
    growingDurationDays: 100, waterRequirement: 'HIGH', suitableClimate: 'MONSOON',
    // Dataset: humidity avg 80% — Bengal's own crop
    minHumidity: 65, maxHumidity: 100, minTemp: 22, maxTemp: 38,
  },
  coffee: {
    cropNameEn: 'Coffee', cropNameHi: 'कॉफी', cropNameBn: 'কফি',
    growingDurationDays: 365, waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON',
    // Dataset: humidity avg 59%, temp avg 25.5°C — hilly cool climate
    minHumidity: 45, maxHumidity: 75, minTemp: 15, maxTemp: 28,
  },
  potato: {
    cropNameEn: 'Potato', cropNameHi: 'आलू', cropNameBn: 'আলু',
    growingDurationDays: 90, waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',
    minHumidity: 40, maxHumidity: 80, minTemp: 10, maxTemp: 24,
  },
  onion: {
    cropNameEn: 'Onion', cropNameHi: 'प्याज', cropNameBn: 'পেঁয়াজ',
    growingDurationDays: 120, waterRequirement: 'LOW', suitableClimate: 'WINTER',
    minHumidity: 25, maxHumidity: 70, minTemp: 12, maxTemp: 28,
  },
  tomato: {
    cropNameEn: 'Tomato', cropNameHi: 'टमाटर', cropNameBn: 'টমেটো',
    growingDurationDays: 75, waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON',
    minHumidity: 45, maxHumidity: 85, minTemp: 18, maxTemp: 35,
  },
  sugarcane: {
    cropNameEn: 'Sugarcane', cropNameHi: 'गन्ना', cropNameBn: 'আখ',
    growingDurationDays: 365, waterRequirement: 'HIGH', suitableClimate: 'ALL_SEASON',
    minHumidity: 60, maxHumidity: 100, minTemp: 22, maxTemp: 40,
  },
  soybean: {
    cropNameEn: 'Soybean', cropNameHi: 'सोयाबीन', cropNameBn: 'সয়াবিন',
    growingDurationDays: 100, waterRequirement: 'MEDIUM', suitableClimate: 'MONSOON',
    minHumidity: 50, maxHumidity: 85, minTemp: 20, maxTemp: 35,
  },
  groundnut: {
    cropNameEn: 'Groundnut', cropNameHi: 'मूंगफली', cropNameBn: 'বাদাম',
    growingDurationDays: 120, waterRequirement: 'LOW', suitableClimate: 'SUMMER',
    minHumidity: 45, maxHumidity: 85, minTemp: 22, maxTemp: 38,
  },
};

const normalizeKey = (name) => name.toLowerCase().replace(/[\s_\-]+/g, '');

const getCropProfile = (mlCropName) => {
  if (!mlCropName) return null;
  return CROP_PROFILES[normalizeKey(mlCropName)] || null;
};

// Filter by season AND actual weather — based on dataset-derived thresholds
const getFilteredCrops = (excludeKey = null, weatherData = null) => {
  const season = getCurrentSeason();

  return Object.entries(CROP_PROFILES)
    .filter(([key, profile]) => {
      if (excludeKey && key === excludeKey) return false;

      // Season filter
      const seasonMatch =
        profile.suitableClimate === season ||
        profile.suitableClimate === 'ALL_SEASON';
      if (!seasonMatch) return false;

      // Weather filter
      if (weatherData) {
        const { temperature, humidity } = weatherData;
        if (temperature < profile.minTemp || temperature > profile.maxTemp) {
          console.log(`🚫 Filtered "${profile.cropNameEn}" — temp ${temperature}°C outside [${profile.minTemp}-${profile.maxTemp}]`);
          return false;
        }
        if (humidity < profile.minHumidity || humidity > profile.maxHumidity) {
          console.log(`🚫 Filtered "${profile.cropNameEn}" — humidity ${humidity}% outside [${profile.minHumidity}-${profile.maxHumidity}]`);
          return false;
        }
      }

      return true;
    })
    .map(([, profile]) => profile)
    .filter((v, i, arr) => arr.findIndex(x => x.cropNameEn === v.cropNameEn) === i)
    .sort((a, b) => a.cropNameEn.localeCompare(b.cropNameEn));
};


// ─── Step 1: Fetch weather + soil from Open-Meteo ─────────────────────────────
// ✅ FIX: Use hourly forecast sum for rainfall instead of current precipitation
// current.precipitation = mm in last hour = almost always 0
// Dataset mean rainfall = 103mm — we need a representative 7-day value
const fetchOpenMeteoData = async (latitude, longitude) => {
  const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'soil_moisture_0_to_1cm',
        'soil_moisture_1_to_3cm',
        'soil_temperature_0cm',
      ].join(','),
      // ✅ Get hourly precipitation over 7 days to compute realistic rainfall
      hourly: 'precipitation',
      forecast_days: 7,
    },
    timeout: 10000,
  });

  const c = response.data.current;
  const hourly = response.data.hourly;

  const temperature   = c.temperature_2m;
  const humidity      = c.relative_humidity_2m;
  const soilMoisture  = c.soil_moisture_0_to_1cm ?? 0.2;
  const soilMoisture2 = c.soil_moisture_1_to_3cm ?? soilMoisture;
  const soilTemp      = c.soil_temperature_0cm    ?? temperature;

  // ✅ Sum 7-day hourly precipitation to get realistic monthly-equivalent rainfall
  // Dataset rainfall range: 20–298mm, mean: 103mm
  const totalRainfall7d = (hourly?.precipitation || [])
    .reduce((sum, val) => sum + (val ?? 0), 0);

  // Scale 7-day sum to approximate monthly equivalent (×4.3)
  // This maps into the dataset's rainfall range meaningfully
  const rainfall = Math.round(Math.min(300, totalRainfall7d * 4.3));

  const avgSoil = (soilMoisture + soilMoisture2) / 2;

  // ✅ RECALIBRATED N/P/K formulas based on dataset analysis:
  // Dataset means: N=50.6, P=53.4, K=48.1
  // Key differentiators in the dataset:
  //   High N (>70): rice, maize, jute, banana, cotton, coffee, muskmelon, watermelon
  //   High P (>60): apple, grapes, chickpea, kidneybeans, lentil (these have P=67-134)
  //   High K (>100): apple, grapes (K=200)
  //   Low humidity: chickpea(17%), kidneybeans(22%), pigeonpeas(48%), mothbeans(53%)
  //
  // Our soil moisture is always 0.2-0.4 for Bengal → avgSoil ≈ 0.3
  // So we need formulas that produce varied N/P/K, not always the same value

  const N = Math.round(Math.max(0, Math.min(140,
    // Base from soil nitrogen availability
    35
    + (avgSoil * 100)           // moisture 0.3 → adds 30 (total ~65)
    + (Math.max(0, soilTemp - 15) * 0.8)  // warm soil boosts N
    + (humidity > 75 ? 10 : 0)  // humid = higher organic N
  )));

  const P = Math.round(Math.max(5, Math.min(145,
    // P is driven more by soil type than moisture
    // Lower base to avoid always hitting 50+
    20
    + (Math.max(0, soilTemp - 10) * 1.5)
    + (avgSoil * 30)
    + (humidity < 50 ? 25 : 0)  // drier soils tend to have more P available
  )));

  const K = Math.round(Math.max(5, Math.min(205,
    25
    + (avgSoil * 50)
    + (temperature * 0.4)
    + (rainfall > 100 ? 10 : 0) // higher rainfall areas leach less K
  )));

  const ph = parseFloat(Math.max(4.5, Math.min(8.5,
    6.5
    - (avgSoil * 0.4)
    + (Math.max(0, temperature - 25) * 0.04)
  )).toFixed(2));

  console.log('─────────────────────────────────────────────────────');
  console.log(`📡 Weather   — temp: ${temperature}°C | humidity: ${humidity}% | rainfall(7d×4.3): ${rainfall}mm`);
  console.log(`🌍 Soil NPK  — N: ${N} | P: ${P} | K: ${K} | pH: ${ph}`);
  console.log('─────────────────────────────────────────────────────');

  return { temperature, humidity, rainfall, N, P, K, ph };
};


// ─── Step 2: POST to ML /predict ─────────────────────────────────────────────
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
    console.log('🔥 Warming up ML model on HuggingFace...');
    await axios.get('https://ridhibratadas-crop-recommendation-api.hf.space', { timeout: 35000 });
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
    console.log(`✅ [ML SUCCESS] Crop list served using ML recommendation`);

    const recommendedKey = normalizeKey(prediction.cropName);
    const profile        = getCropProfile(prediction.cropName);
    const allCropsList   = getFilteredCrops(recommendedKey, weatherData);

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
    console.log(`⚠️ [ML FAILED — FALLBACK LIST] Reason: ${error.message}`);

    // Try to get weather for filtered fallback
    let weatherData = null;
    try {
      weatherData = await fetchOpenMeteoData(latitude, longitude);
    } catch (e) {
      console.log('⚠️ Weather fetch also failed — season-only filter used');
    }

    return {
      success:  false,
      error:    error.message,
      allCrops: getFilteredCrops(null, weatherData),
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