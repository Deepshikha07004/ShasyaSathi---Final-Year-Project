const axios = require('axios');

class TranslationService {
  constructor() {
    this.myMemoryUrl = 'https://api.mymemory.translated.net/get';
    this.googleTranslateUrl = 'https://translate.googleapis.com/translate_a/single';

    this.languageCodes = {
      'ENGLISH': 'en',
      'HINDI': 'hi',
      'BENGALI': 'bn'
    };

    // ✅ Static map ONLY for OpenWeather keywords — used by weather controller
    // All other features continue using translateText() with Google Translate
    this.weatherKeywordMap = {
      HINDI: {
        // Main conditions (exact strings OpenWeather returns)
        'Clear': 'साफ',
        'Clouds': 'बादल',
        'Rain': 'बारिश',
        'Drizzle': 'बूंदाबांदी',
        'Thunderstorm': 'आंधी-तूफ़ान',
        'Snow': 'बर्फ',
        'Mist': 'कोहरा',
        'Smoke': 'धुआं',
        'Haze': 'धुंध',
        'Dust': 'धूल',
        'Fog': 'घना कोहरा',
        'Sand': 'रेत',
        'Ash': 'राख',
        'Squall': 'आंधी',
        'Tornado': 'बवंडर',
        // Descriptions
        'clear sky': 'साफ आसमान',
        'few clouds': 'थोड़े बादल',
        'scattered clouds': 'बिखरे बादल',
        'broken clouds': 'टूटे बादल',
        'overcast clouds': 'घने बादल',
        'light rain': 'हल्की बारिश',
        'moderate rain': 'मध्यम बारिश',
        'heavy intensity rain': 'भारी बारिश',
        'very heavy rain': 'बहुत भारी बारिश',
        'light drizzle': 'हल्की बूंदाबांदी',
        'freezing rain': 'बर्फीली बारिश',
        'thunderstorm with light rain': 'हल्की बारिश के साथ गरज',
        'thunderstorm with rain': 'बारिश के साथ गरज',
        'thunderstorm with heavy rain': 'भारी बारिश के साथ गरज',
        'light thunderstorm': 'हल्का तूफ़ान',
        'heavy thunderstorm': 'भारी तूफ़ान',
        'mist': 'कोहरा',
        'haze': 'धुंध',
        'fog': 'घना कोहरा',
        'smoke': 'धुआं',
        'sand': 'रेत',
        'dust whirls': 'धूल के बवंडर',
        'volcanic ash': 'ज्वालामुखी राख',
        'squalls': 'आंधी',
        'tornado': 'बवंडर',
      },
      BENGALI: {
        // Main conditions
        'Clear': 'পরিষ্কার',
        'Clouds': 'মেঘ',
        'Rain': 'বৃষ্টি',
        'Drizzle': 'গুঁড়ি গুঁড়ি বৃষ্টি',
        'Thunderstorm': 'বজ্রঝড়',
        'Snow': 'তুষার',
        'Mist': 'কুয়াশা',
        'Smoke': 'ধোঁয়া',
        'Haze': 'ধোঁয়াশা',
        'Dust': 'ধুলো',
        'Fog': 'ঘন কুয়াশা',
        'Sand': 'বালি',
        'Ash': 'ছাই',
        'Squall': 'ঝড়',
        'Tornado': 'টর্নেডো',
        // Descriptions
        'clear sky': 'পরিষ্কার আকাশ',
        'few clouds': 'সামান্য মেঘ',
        'scattered clouds': 'ছড়ানো মেঘ',
        'broken clouds': 'ভাঙা মেঘ',
        'overcast clouds': 'ঘন মেঘ',
        'light rain': 'হালকা বৃষ্টি',
        'moderate rain': 'মাঝারি বৃষ্টি',
        'heavy intensity rain': 'ভারী বৃষ্টি',
        'very heavy rain': 'অতি ভারী বৃষ্টি',
        'light drizzle': 'হালকা গুঁড়ি বৃষ্টি',
        'freezing rain': 'হিমবৃষ্টি',
        'thunderstorm with light rain': 'হালকা বৃষ্টিসহ বজ্রপাত',
        'thunderstorm with rain': 'বৃষ্টিসহ বজ্রপাত',
        'thunderstorm with heavy rain': 'ভারী বৃষ্টিসহ বজ্রপাত',
        'light thunderstorm': 'হালকা বজ্রঝড়',
        'heavy thunderstorm': 'ভারী বজ্রঝড়',
        'mist': 'কুয়াশা',
        'haze': 'ধোঁয়াশা',
        'fog': 'ঘন কুয়াশা',
        'smoke': 'ধোঁয়া',
        'sand': 'বালি',
        'dust whirls': 'ধুলার ঘূর্ণি',
        'volcanic ash': 'আগ্নেয়গিরির ছাই',
        'squalls': 'ঝড়',
        'tornado': 'টর্নেডো',
      }
    };

    console.log('🌐 Translation Service initialized');
  }

  // ─────────────────────────────────────────────────────────────────
  // ✅ NEW METHOD — only for weather keywords (instant, no network)
  // Called by weather.controller.js instead of translateText()
  // ─────────────────────────────────────────────────────────────────
  translateWeatherKeyword(text, targetLanguage) {
    if (!text || targetLanguage === 'ENGLISH') return text;

    const map = this.weatherKeywordMap[targetLanguage];
    if (!map) return text;

    // Try exact match first
    if (map[text] !== undefined) return map[text];

    // Try case-insensitive match as fallback
    const lower = text.toLowerCase();
    for (const [key, val] of Object.entries(map)) {
      if (key.toLowerCase() === lower) return val;
    }

    // No match found — return original so it always shows something
    console.warn(`⚠️  No weather translation found for: "${text}" in ${targetLanguage}`);
    return text;
  }

  // ─────────────────────────────────────────────────────────────────
  // All methods below are UNCHANGED — other features use these
  // ─────────────────────────────────────────────────────────────────

  async translateWithGoogle(text, targetLanguage) {
    try {
      const targetLang = this.languageCodes[targetLanguage];

      console.log(`🌐 Google Translate: "${text.substring(0, 80)}"`);

      const response = await axios.get(this.googleTranslateUrl, {
        params: {
          client: 'gtx',
          sl: 'en',
          tl: targetLang,
          dt: 't',
          q: text
        },
        timeout: 15000
      });

      if (response.data && response.data[0] && response.data[0][0]) {
        const translated = response.data[0][0][0];
        console.log(`✅ Translated to: "${translated.substring(0, 80)}"`);
        return translated;
      }

      console.warn('⚠️  Translation failed, returning original');
      return text;
    } catch (error) {
      console.error('❌ Google Translate error:', error.message);
      return text;
    }
  }

  async translateText(text, targetLanguage) {
    try {
      if (targetLanguage === 'ENGLISH' || !text || text.trim() === '') {
        return text;
      }

      const targetLang = this.languageCodes[targetLanguage];

      if (!targetLang) {
        console.warn(`Unknown language: ${targetLanguage}`);
        return text;
      }

      const isAllCaps = text === text.toUpperCase() && text !== text.toLowerCase();
      let textToTranslate = text;

      if (isAllCaps && text.length > 3) {
        textToTranslate = text.toLowerCase().split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        console.log(`🔄 Converted: "${text}" → "${textToTranslate}"`);
      }

      const truncatedText = textToTranslate.substring(0, 500);

      console.log(`🌐 Translating: "${truncatedText.substring(0, 50)}"`);

      const translation = await this.translateWithGoogle(truncatedText, targetLanguage);

      console.log(`✅ Result: "${translation.substring(0, 50)}"`);
      return translation;

    } catch (error) {
      console.error('❌ Translation error:', error.message);
      return text;
    }
  }

  async translateBatch(texts, targetLanguage) {
    try {
      if (targetLanguage === 'ENGLISH' || !texts || texts.length === 0) {
        return texts;
      }

      console.log(`🌐 Batch translating ${texts.length} items`);

      const translations = [];

      for (let i = 0; i < texts.length; i++) {
        const translated = await this.translateText(texts[i], targetLanguage);
        translations.push(translated);

        if (i < texts.length - 1) {
          await this.delay(200);
        }
      }

      return translations;

    } catch (error) {
      console.error('❌ Batch translation error:', error.message);
      return texts;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new TranslationService();