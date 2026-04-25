// Import required packages
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Initialize Express app
const app = express();


// ===============================
// MIDDLEWARE
// ===============================
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ===============================
// ROUTES IMPORT
// ===============================
const authRoutes        = require('./routes/auth.routes');
const userRoutes        = require('./routes/user.routes');
const cropRoutes        = require('./routes/crop.routes');
const chatRoutes        = require('./routes/chat.routes');
const locationRoutes    = require('./routes/location.routes');
const weatherRoutes     = require('./routes/weather.routes');
const advisoryRoutes    = require('./routes/advisory.routes');
const harvestRoutes     = require('./cold-storage/routes/harvest.routes');
const coldStorageRoutes = require('./cold-storage/routes/coldStorage.routes');


// ===============================
// BASIC ROUTES
// ===============================
app.get('/', (req, res) => {
  res.json({ message: 'KrishiSaathi API 🌾', version: '1.0.0', status: 'active' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});


// ===============================
// API ROUTES
// ===============================
app.use('/api/auth',         authRoutes);
app.use('/api/users',        userRoutes);
app.use('/api/crops',        cropRoutes);
app.use('/api/chat',         chatRoutes);
app.use('/api/location',     locationRoutes);
app.use('/api/weather',      weatherRoutes);
app.use('/api/advisory',     advisoryRoutes);
app.use('/api/harvest',      harvestRoutes);
app.use('/api/cold-storage', coldStorageRoutes);


// ===============================
// GLOBAL ERROR HANDLER
// ===============================
app.use((err, req, res, next) => {
  console.error('Global Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});


// ===============================
// 404 HANDLER
// ===============================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});


// ===============================
// START SERVER
// Crop data now comes entirely from the ML model + CROP_PROFILES
// knowledge base in ml.service.js. No DB seed needed.
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API URL: http://localhost:${PORT}`);
  console.log(`\n📦 Features Enabled:`);
  console.log(`   ✅ Weather API`);
  console.log(`   ✅ Location Services`);
  console.log(`   ✅ AI Chat`);
  console.log(`   ✅ ML Crop Recommendation (Open-Meteo + ML model)`);
  console.log(`   ✅ Cold Storage Finder`);
  console.log(`   ✅ Harvest Management`);
});