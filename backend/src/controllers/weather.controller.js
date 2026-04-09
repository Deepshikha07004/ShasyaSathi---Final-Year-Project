const weatherService = require('../services/weather.service');
const translationService = require('../services/translation.service');

// Maps frontend lang codes (en/hi/bn) to backend enum values (ENGLISH/HINDI/BENGALI)
const langCodeMap = {
  'en': 'ENGLISH',
  'hi': 'HINDI',
  'bn': 'BENGALI',
};

class WeatherController {

  async getWeather(req, res) {
    try {
      const farmerId = req.farmer.id;

      const data = await weatherService.getWeatherForActiveLocation(farmerId);

      // ✅ If frontend passes ?lang=bn (local change), use that.
      // Otherwise fall back to the DB stored language.
      const queryLang = req.query.lang ? langCodeMap[req.query.lang] : null;
      const language = queryLang || req.farmer.preferredLanguage || 'ENGLISH';

      if (language !== 'ENGLISH') {
        data.current.weatherMainOriginal = data.current.weatherMain;
        data.current.weatherMain = translationService.translateWeatherKeyword(
          data.current.weatherMain,
          language
        );
        data.current.weatherDesc = translationService.translateWeatherKeyword(
          data.current.weatherDesc,
          language
        );

        for (let i = 0; i < data.forecast.length; i++) {
          data.forecast[i].weatherMainOriginal = data.forecast[i].weatherMain;
          data.forecast[i].weatherMain = translationService.translateWeatherKeyword(
            data.forecast[i].weatherMain,
            language
          );
        }
      } else {
        data.current.weatherMainOriginal = data.current.weatherMain;
        data.forecast.forEach(d => {
          d.weatherMainOriginal = d.weatherMain;
        });
      }

      data.language = language;

      return res.json({ success: true, data });

    } catch (error) {
      console.log("Weather controller error:", error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = new WeatherController();