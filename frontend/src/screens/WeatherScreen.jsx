import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  ImageBackground,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { AppContext } from '../context/AppContext';
import { BASE_URL } from '../api/apiClient';

const WeatherScreen = ({ navigation }) => {
  const { lang, setLang } = useContext(AppContext);

  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [language, setLanguage] = useState('ENGLISH');
  const [speaking, setSpeaking] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);

  const API_BASE_URL = BASE_URL;

  const translations = {
    ENGLISH: {
      feelsLike: 'Feels like',
      humidity: 'Humidity',
      windSpeed: 'Wind Speed',
      pressure: 'Pressure',
      visibility: 'Visibility',
      forecast: '5-Day Forecast',
      today: 'Today',
      loading: 'Loading weather...',
      error: 'Unable to load weather',
      listenWeather: 'Hear Weather',
      sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
      thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
      sundayFull: 'Sunday', mondayFull: 'Monday', tuesdayFull: 'Tuesday',
      wednesdayFull: 'Wednesday', thursdayFull: 'Thursday',
      fridayFull: 'Friday', saturdayFull: 'Saturday',
      summer: 'Summer ☀️', monsoon: 'Monsoon 🌧️',
      autumn: 'Autumn 🍂', winter: 'Winter ❄️',
      jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr',
      may: 'May', jun: 'Jun', jul: 'Jul', aug: 'Aug',
      sep: 'Sep', oct: 'Oct', nov: 'Nov', dec: 'Dec',
    },
    HINDI: {
      feelsLike: 'महसूस होता है',
      humidity: 'नमी',
      windSpeed: 'हवा की गति',
      pressure: 'दबाव',
      visibility: 'दृश्यता',
      forecast: '5-दिन का पूर्वानुमान',
      today: 'आज',
      loading: 'मौसम लोड हो रहा है...',
      error: 'मौसम लोड नहीं हो सका',
      listenWeather: 'मौसम सुनें',
      sunday: 'रवि', monday: 'सोम', tuesday: 'मंगल', wednesday: 'बुध',
      thursday: 'गुरु', friday: 'शुक्र', saturday: 'शनि',
      sundayFull: 'रविवार', mondayFull: 'सोमवार', tuesdayFull: 'मंगलवार',
      wednesdayFull: 'बुधवार', thursdayFull: 'गुरुवार',
      fridayFull: 'शुक्रवार', saturdayFull: 'शनिवार',
      summer: 'गर्मी ☀️', monsoon: 'मानसून 🌧️',
      autumn: 'शरद ऋतु 🍂', winter: 'सर्दी ❄️',
      jan: 'जन', feb: 'फर', mar: 'मार्च', apr: 'अप्रै',
      may: 'मई', jun: 'जून', jul: 'जुला', aug: 'अग',
      sep: 'सित', oct: 'अक्टू', nov: 'नव', dec: 'दिस',
    },
    BENGALI: {
      feelsLike: 'মনে হচ্ছে',
      humidity: 'আর্দ্রতা',
      windSpeed: 'বাতাসের গতি',
      pressure: 'চাপ',
      visibility: 'দৃশ্যমানতা',
      forecast: '৫-দিনের পূর্বাভাস',
      today: 'আজ',
      loading: 'আবহাওয়া লোড হচ্ছে...',
      error: 'আবহাওয়া লোড করা যায়নি',
      listenWeather: 'আবহাওয়া শুনুন',
      sunday: 'রবি', monday: 'সোম', tuesday: 'মঙ্গল', wednesday: 'বুধ',
      thursday: 'বৃহস্পতি', friday: 'শুক্র', saturday: 'শনি',
      sundayFull: 'রবিবার', mondayFull: 'সোমবার', tuesdayFull: 'মঙ্গলবার',
      wednesdayFull: 'বুধবার', thursdayFull: 'বৃহস্পতিবার',
      fridayFull: 'শুক্রবার', saturdayFull: 'শনিবার',
      summer: 'গ্রীষ্ম ☀️', monsoon: 'বর্ষা 🌧️',
      autumn: 'শরৎ 🍂', winter: 'শীত ❄️',
      jan: 'জানু', feb: 'ফেব', mar: 'মার্চ', apr: 'এপ্রি',
      may: 'মে', jun: 'জুন', jul: 'জুলা', aug: 'আগ',
      sep: 'সেপ্টে', oct: 'অক্টো', nov: 'নভে', dec: 'ডিসে',
    },
  };

  // ─── Language options for the modal ───────────────────────────────────────
  const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिंदी' },
    { code: 'bn', label: 'বাংলা' },
  ];

  // ─── Inject language button into the navigation header ────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setLangModalVisible(true)}
          style={{ marginRight: 15, flexDirection: 'row', alignItems: 'center' }}
        >
          <Ionicons name="language" size={24} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token) { setLoading(false); return; }

      const response = await fetch(`${API_BASE_URL}/api/weather?lang=${lang}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success && data.data) {
        setWeatherData(data.data);
        setLanguage(data.data.language || 'ENGLISH');
      }
    } catch (error) {
      console.error('Weather fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Re-fetch whenever user changes language
  useEffect(() => {
    fetchWeather();
  }, [lang]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchWeather();
  };

  // ─── Build the speech text in the correct language ────────────────────────
  const buildSpeechText = () => {
  if (!weatherData) return '';
  const { location, current } = weatherData;
  const place = location?.area || location?.district || '';
  const visibility = current.visibility
    ? (current.visibility / 1000).toFixed(1)
    : null;

  if (language === 'HINDI') {
    return (
      `${place} में आज का मौसम। ` +
      `तापमान ${current.temperature} डिग्री है। ` +
      `महसूस होता है ${current.feelsLike} डिग्री। ` +
      `आसमान में ${current.weatherMain}। ` +
      `नमी ${current.humidity} प्रतिशत। ` +
      `हवा की गति ${current.windSpeed.toFixed(1)} मीटर प्रति सेकंड। ` +
      `वायुदाब ${current.pressure} हेक्टोपास्कल। ` +
      (visibility ? `दृश्यता ${visibility} किलोमीटर।` : '')
    );
  }

  if (language === 'BENGALI') {
    return (
      `${place} এ আজকের আবহাওয়া। ` +
      `তাপমাত্রা ${current.temperature} ডিগ্রি। ` +
      `মনে হচ্ছে ${current.feelsLike} ডিগ্রি। ` +
      `আকাশে ${current.weatherMain}। ` +
      `আর্দ্রতা ${current.humidity} শতাংশ। ` +
      `বাতাসের গতি ${current.windSpeed.toFixed(1)} মিটার প্রতি সেকেন্ড। ` +
      `বায়ুচাপ ${current.pressure} হেক্টোপাসকাল। ` +
      (visibility ? `দৃশ্যমানতা ${visibility} কিলোমিটার।` : '')
    );
  }

  // English default
  return (
    `Today's weather in ${place}. ` +
    `Temperature is ${current.temperature} degrees. ` +
    `Feels like ${current.feelsLike} degrees. ` +
    `${current.weatherMain}. ` +
    `Humidity ${current.humidity} percent. ` +
    `Wind speed ${current.windSpeed.toFixed(1)} meters per second. ` +
    `Pressure ${current.pressure} hectopascals. ` +
    (visibility ? `Visibility ${visibility} kilometres.` : '')
  );
};

  // ─── TTS language codes ───────────────────────────────────────────────────
  const speechLangCode = {
    ENGLISH: 'en-IN',
    HINDI: 'hi-IN',
    BENGALI: 'bn-IN',
  };

  const handleSpeak = async () => {
    // If already speaking, stop
    const isSpeaking = await Speech.isSpeakingAsync();
    if (isSpeaking) {
      await Speech.stop();
      setSpeaking(false);
      return;
    }

    const text = buildSpeechText();
    setSpeaking(true);
    Speech.speak(text, {
      language: speechLangCode[language] || 'en-IN',
      pitch: 1.0,
      rate: 0.9,   // slightly slower — easier for farmers to follow
      onDone: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const t = translations[language] || translations.ENGLISH;

  const getWeatherIcon = (condition) => {
    const map = {
      Clear: 'weather-sunny', Clouds: 'weather-cloudy',
      Rain: 'weather-rainy', Thunderstorm: 'weather-lightning',
      Drizzle: 'weather-rainy', Mist: 'weather-fog',
      Haze: 'weather-fog', Fog: 'weather-fog',
      Snow: 'weather-snowy', Smoke: 'weather-fog',
      Dust: 'weather-windy', Sand: 'weather-windy',
      Squall: 'weather-hurricane', Tornado: 'weather-tornado',
    };
    return map[condition] || 'weather-cloudy';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const days = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday];
    return days[date.getDay()];
  };

  const getCurrentDate = () => {
    const date = new Date();
    const days = [t.sundayFull, t.mondayFull, t.tuesdayFull, t.wednesdayFull, t.thursdayFull, t.fridayFull, t.saturdayFull];
    const months = [t.jan, t.feb, t.mar, t.apr, t.may, t.jun, t.jul, t.aug, t.sep, t.oct, t.nov, t.dec];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} (${days[date.getDay()]})`;
  };

  const getSeason = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return t.summer;
    if (m >= 6 && m <= 9) return t.monsoon;
    if (m >= 10 && m <= 11) return t.autumn;
    return t.winter;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>{t.loading}</Text>
      </View>
    );
  }

  if (!weatherData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t.error}</Text>
      </View>
    );
  }

  const { location, current, forecast } = weatherData;
  const upcomingForecast = forecast.slice(1, 5);

  return (
    <ImageBackground source={require('../assets/weather.jpg')} style={styles.background}>
      <View style={styles.overlay}>
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {/* Location */}
          <Text style={styles.locationText}>
            {location?.area || location?.district || 'Your Location'}
          </Text>

          {/* Main Weather Box */}
          <View style={styles.mainWeatherBox}>
            <Text style={styles.dateText}>{getCurrentDate()}</Text>
            <Text style={styles.seasonText}>{getSeason()}</Text>
            <View style={styles.divider} />

            <MaterialCommunityIcons
              name={getWeatherIcon(current.weatherMainOriginal)}
              size={80}
              color="#fff"
            />

            <Text style={styles.temperatureText}>{current.temperature}°</Text>
            <Text style={styles.conditionText}>{current.weatherMain}</Text>
            <Text style={styles.feelsLikeText}>{t.feelsLike} {current.feelsLike}°</Text>

            {/* ─── TTS Button ─────────────────────────────────────── */}
            <TouchableOpacity
              onPress={handleSpeak}
              style={[styles.speakButton, speaking && styles.speakButtonActive]}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={speaking ? 'stop-circle-outline' : 'volume-high'}
                size={22}
                color="#fff"
              />
              <Text style={styles.speakButtonText}>
                {speaking
                  ? (language === 'HINDI' ? 'रोकें' : language === 'BENGALI' ? 'থামুন' : 'Stop')
                  : t.listenWeather}
              </Text>
            </TouchableOpacity>
            {/* ──────────────────────────────────────────────────── */}
          </View>

          {/* Weather Details */}
          <View style={styles.detailsBox}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="water" size={30} color="#fff" />
                <Text style={styles.detailValue}>{current.humidity}%</Text>
                <Text style={styles.detailLabel}>{t.humidity}</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="weather-windy" size={30} color="#fff" />
                <Text style={styles.detailValue}>{current.windSpeed.toFixed(1)} m/s</Text>
                <Text style={styles.detailLabel}>{t.windSpeed}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="gauge" size={30} color="#fff" />
                <Text style={styles.detailValue}>{current.pressure} hPa</Text>
                <Text style={styles.detailLabel}>{t.pressure}</Text>
              </View>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="eye" size={30} color="#fff" />
                <Text style={styles.detailValue}>
                  {current.visibility ? (current.visibility / 1000).toFixed(1) : 'N/A'} km
                </Text>
                <Text style={styles.detailLabel}>{t.visibility}</Text>
              </View>
            </View>
          </View>

          {/* 5-Day Forecast */}
          <Text style={styles.forecastTitle}>{t.forecast}</Text>
          <View style={styles.forecastSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.forecastBox}>
                <Text style={styles.forecastDay}>{t.today}</Text>
                <MaterialCommunityIcons
                  name={getWeatherIcon(current.weatherMainOriginal)}
                  size={35} color="#FFD54F"
                />
                <Text style={styles.forecastTemp}>
                  {forecast[0]?.tempMax || current.temperature}°/
                  {forecast[0]?.tempMin || current.temperature}°
                </Text>
                <Text style={styles.forecastCondition} numberOfLines={1}>
                  {current.weatherMain}
                </Text>
              </View>

              {upcomingForecast.map((day, index) => (
                <View key={index} style={styles.forecastBox}>
                  <Text style={styles.forecastDay}>{formatDate(day.date)}</Text>
                  <MaterialCommunityIcons
                    name={getWeatherIcon(day.weatherMainOriginal)}
                    size={35} color="#FFD54F"
                  />
                  <Text style={styles.forecastTemp}>{day.tempMax}°/{day.tempMin}°</Text>
                  <Text style={styles.forecastCondition} numberOfLines={1}>
                    {day.weatherMain}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

        </ScrollView>
      </View>

      {/* ─── Language Picker Modal ──────────────────────────────────────────── */}
      <Modal
        visible={langModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLangModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLangModalVisible(false)}
        >
          <View style={styles.langModal}>
            <Text style={styles.langModalTitle}>
              {language === 'HINDI' ? 'भाषा चुनें' : language === 'BENGALI' ? 'ভাষা বেছে নিন' : 'Choose Language'}
            </Text>
            {languageOptions.map(({ code, label }, i) => {
              const isActive = lang === code;
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => {
                    setLang(code);
                    setLangModalVisible(false);
                  }}
                  style={[
                    styles.langOption,
                    isActive && styles.langOptionActive,
                    i < languageOptions.length - 1 && styles.langOptionBorder,
                  ]}
                >
                  <Text style={[styles.langLabel, isActive && styles.langLabelActive]}>
                    {label}
                  </Text>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color="#2E7D32" style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
      {/* ──────────────────────────────────────────────────────────────────── */}

    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: 60 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#fff' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 16 },
  locationText: { color: '#fff', textAlign: 'center', fontSize: 20, marginTop: 10, marginBottom: 20, fontWeight: '500' },
  mainWeatherBox: { margin: 20, borderRadius: 25, padding: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center' },
  dateText: { color: '#fff', fontSize: 16, fontWeight: '500', marginBottom: 5 },
  seasonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  divider: { width: '80%', height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginBottom: 15 },
  temperatureText: { fontSize: 60, color: '#fff', fontWeight: 'bold', marginTop: 10 },
  conditionText: { color: '#fff', fontSize: 18, marginTop: 5 },
  feelsLikeText: { color: '#fff', marginTop: 5, fontSize: 14 },

  // TTS Button
  speakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: 'rgba(46,125,50,0.85)',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    gap: 8,
  },
  speakButtonActive: {
    backgroundColor: 'rgba(183,28,28,0.85)', // red when playing so farmer knows to tap to stop
  },
  speakButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  detailsBox: { marginHorizontal: 20, marginBottom: 20, borderRadius: 20, padding: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
  detailItem: { alignItems: 'center', flex: 1 },
  detailValue: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 5 },
  detailLabel: { color: '#fff', fontSize: 12, marginTop: 2 },
  forecastTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 20, marginBottom: 10 },
  forecastSection: { paddingHorizontal: 10, marginBottom: 20 },
  forecastBox: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 15, padding: 15, marginLeft: 10, alignItems: 'center', width: 90 },
  forecastDay: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  forecastTemp: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 5 },
  forecastCondition: { color: '#fff', fontSize: 11, marginTop: 3, textAlign: 'center' },

  // Language Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  langModal: { backgroundColor: '#fff', borderRadius: 20, width: '75%', paddingTop: 20, paddingBottom: 10, elevation: 20 },
  langModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 15, paddingHorizontal: 20 },
  langOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  langOptionActive: { backgroundColor: '#f1f8e9' },
  langOptionBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  langLabel: { fontSize: 17, color: '#333' },
  langLabelActive: { color: '#2E7D32', fontWeight: 'bold' },
});

export default WeatherScreen;