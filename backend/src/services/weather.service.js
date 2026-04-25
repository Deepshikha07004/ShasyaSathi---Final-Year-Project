const prisma = require('../config/prisma');
const axios = require('axios');

class WeatherService {

  async getCurrentWeather(lat, lon) {
    const res = await axios.get(`${process.env.OPENWEATHER_BASE_URL}/weather`, {
      params: {
        lat,
        lon,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
      }
    });

    const d = res.data;

    return {
      temperature:  Math.round(d.main.temp),
      feelsLike:    Math.round(d.main.feels_like),
      humidity:     d.main.humidity,
      windSpeed:    d.wind.speed,
      weatherMain:  d.weather[0].main,
      weatherDesc:  d.weather[0].description,
      pressure:     d.main.pressure,
      visibility:   d.visibility,
      weatherIcon:  d.weather[0].icon || '',
    };
  }

  async getForecast(lat, lon) {
    const res = await axios.get(`${process.env.OPENWEATHER_BASE_URL}/forecast`, {
      params: {
        lat,
        lon,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
      }
    });

    const map = {};

    res.data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const key  = date.toISOString().split('T')[0];

      if (!map[key]) {
        map[key] = {
          date,
          temps:       [],
          weatherMain: item.weather[0].main,
          // ✅ FIX: capture weatherDesc, humidity, windSpeed per slot
          weatherDesc: item.weather[0].description,
          weatherIcon: item.weather[0].icon || '',
          humidity:    item.main.humidity,
          windSpeed:   item.wind?.speed ?? 0,
        };
      }

      map[key].temps.push(item.main.temp);
    });

    return Object.values(map).map(d => ({
      date:        d.date,
      tempMax:     Math.round(Math.max(...d.temps)),
      tempMin:     Math.round(Math.min(...d.temps)),
      weatherMain: d.weatherMain,
      // ✅ FIX: include all required schema fields
      weatherDesc: d.weatherDesc,
      weatherIcon: d.weatherIcon,
      humidity:    d.humidity,
      windSpeed:   d.windSpeed,
    })).slice(0, 5);
  }

  async getWeatherForActiveLocation(farmerId) {
    const location = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!location) throw new Error('No active location');

    const current  = await this.getCurrentWeather(location.latitude, location.longitude);
    const forecast = await this.getForecast(location.latitude, location.longitude);

    // Save to DB async (non-blocking)
    this._saveWeatherData(location.id, current).catch(err =>
      console.log('Weather save error (non-fatal):', err.message)
    );
    this._saveForecastData(location.id, forecast).catch(err =>
      console.log('Forecast save error (non-fatal):', err.message)
    );

    return { location, current, forecast };
  }

  async _saveWeatherData(locationId, current) {
    await prisma.weatherData.upsert({
      where:  { locationId },
      update: {
        temperature:  current.temperature,
        feelsLike:    current.feelsLike,
        humidity:     current.humidity,
        windSpeed:    current.windSpeed,
        weatherMain:  current.weatherMain,
        weatherDesc:  current.weatherDesc,
        weatherIcon:  current.weatherIcon,
        pressure:     current.pressure,
        visibility:   current.visibility,
        fetchedAt:    new Date(),
      },
      create: {
        locationId,
        temperature:  current.temperature,
        feelsLike:    current.feelsLike,
        humidity:     current.humidity,
        windSpeed:    current.windSpeed,
        weatherMain:  current.weatherMain,
        weatherDesc:  current.weatherDesc,
        weatherIcon:  current.weatherIcon,
        pressure:     current.pressure,
        visibility:   current.visibility,
        fetchedAt:    new Date(),
      },
    });
  }

  async _saveForecastData(locationId, forecast) {
    // Delete old forecasts for this location
    await prisma.weatherForecast.deleteMany({ where: { locationId } });

    // ✅ FIX: include all required fields (weatherDesc, humidity, windSpeed)
    const forecastRecords = forecast.map(f => ({
      locationId,
      date:        f.date,
      tempMax:     f.tempMax,
      tempMin:     f.tempMin,
      weatherMain: f.weatherMain,
      weatherDesc: f.weatherDesc || f.weatherMain,   // fallback to weatherMain if missing
      weatherIcon: f.weatherIcon,
      humidity:    f.humidity    ?? 50,
      windSpeed:   f.windSpeed   ?? 0,
    }));

    await prisma.weatherForecast.createMany({ data: forecastRecords });
  }

}

module.exports = new WeatherService();