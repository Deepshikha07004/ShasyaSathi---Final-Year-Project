import React, { useState, useContext, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert, TextInput, Platform, Vibration, ImageBackground,
  KeyboardAvoidingView, StyleSheet, FlatList, Modal
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../api/apiClient";

const LocationScreen = ({ navigation }) => {

  const { t, setLocation, lang } = useContext(AppContext);

  // UI States
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [apiError, setApiError] = useState(false);

  // Location States
  const [coordinates, setCoordinates] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [showMap, setShowMap] = useState(false);

  // Manual mode states
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Saved Locations
  const [savedLocations, setSavedLocations] = useState([]);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Speaker state
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerSpeaking, setIsSpeakerSpeaking] = useState(false);

  const hasFetchedOnMount = useRef(false);
  const speechInProgressRef = useRef(false);

  const BACKEND_API_URL = `${BASE_URL}/api/location`;

  // ===================================
  // ✅ LANGUAGE-AWARE MSG OBJECT
  // All visible UI text and spoken strings now respect the farmer's language
  // ===================================
  const msg = {
    enterFarmName:           t.farmName              || "Farm Name",
    locationFound:           t.locationFoundSuccess  || "Location found successfully",
    locationFailed:          t.locationFailed        || "Failed to get location. Please try again.",
    permissionDenied:        t.permissionDeniedMsg   || "Location permission denied. Please enable in settings.",
    enterManually:           t.enterManually         || "Enter Manually",
    detectAutomatically:     t.detectAutomatically   || "Detect Automatically",
    confirmLocation:         t.confirmLocationBtn    || "Confirm Location",
    youAreHere:              t.youAreHere            || "You are here",
    detectAgain:             t.detectAgain           || "Detect Again",
    continue:                t.continue              || "Continue",
    meters:                  "meters",
    selectLocation:          t.selectLocation        || "Select Your Location",
    error:                   t.locationError         || "Error",
    pleaseFillFields:        lang === "hi" ? "कृपया सभी आवश्यक फ़ील्ड भरें" : lang === "bn" ? "অনুগ্রহ করে সমস্ত প্রয়োজনীয় তথ্য পূরণ করুন" : "Please fill in all required fields",
    enterManuallyTitle:      t.enterManuallyTitle    || "Enter Location Manually",
    usingGPS:                t.usingGPS              || "Using GPS to find your location.",
    sendingToServer:         lang === "hi" ? "स्थान विवरण प्राप्त हो रहा है..." : lang === "bn" ? "অবস্থানের বিবরণ পাওয়া হচ্ছে..." : "Getting location details...",
    serverError:             lang === "hi" ? "कुछ गलत हो गया। कृपया पुनः प्रयास करें।" : lang === "bn" ? "কিছু একটা ভুল হয়েছে। আবার চেষ্টা করুন।" : "Something went wrong. Please try again.",
    retryButton:             lang === "hi" ? "पुनः प्रयास करें" : lang === "bn" ? "আবার চেষ্টা করুন" : "Try Again",
    retry:                   lang === "hi" ? "पुनः प्रयास करें" : lang === "bn" ? "আবার চেষ্টা করুন" : "Try Again",
    manualAddressPlaceholder:lang === "hi" ? "अपना पता दर्ज करें" : lang === "bn" ? "আপনার ঠিকানা লিখুন" : "Enter your address manually",
    getLocationButton:       lang === "hi" ? "मेरा स्थान पाएं" : lang === "bn" ? "আমার অবস্থান পান" : "Get My Location",
    mapLoading:              lang === "hi" ? "नक्शा लोड हो रहा है..." : lang === "bn" ? "মানচিত্র লোড হচ্ছে..." : "Loading map...",
    locationOnMap:           t.locationOnMap         || "Your location on map",
    addNewLocation:          t.addNewLocation        || "Add New Location",
    otherAddresses:          t.otherAddresses        || "Other Addresses",
    enterNameForLocation:    t.enterNameForLocation  || "Enter a name (e.g., My Farm, Home)",
    findOnMap:               lang === "hi" ? "नक्शे पर खोजें" : lang === "bn" ? "মানচিত্রে খুঁজুন" : "Find on Map",
    skip:                    "SKIP TO HOME (TEMP)",
    // ✅ Label for the city/area field — changed from "City" to "Area"
    areaLabel:               lang === "hi" ? "क्षेत्र" : lang === "bn" ? "এলাকা" : "Area",
    districtLabel:           lang === "hi" ? "जिला" : lang === "bn" ? "জেলা" : "District",
    stateLabel:              lang === "hi" ? "राज्य" : lang === "bn" ? "রাজ্য" : "State",
    countryLabel:            lang === "hi" ? "देश" : lang === "bn" ? "দেশ" : "Country",
    latitudeLabel:           lang === "hi" ? "अक्षांश" : lang === "bn" ? "অক্ষাংশ" : "Latitude",
    longitudeLabel:          lang === "hi" ? "देशांतर" : lang === "bn" ? "দ্রাঘিমাংশ" : "Longitude",
  };

  // ===================================
  // LOAD SAVED LOCATIONS FROM BACKEND
  // ===================================
  const loadSavedLocations = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const response = await fetch(BACKEND_API_URL, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return;

      const data = await response.json();

      const normalized = data.map((loc) => ({
        ...loc,
        locationName: loc.locationName || loc.name || "My Farm",
        latitude: loc.latitude ?? loc.coordinates?.latitude,
        longitude: loc.longitude ?? loc.coordinates?.longitude,
      }));

      setSavedLocations(normalized);
    } catch (error) {
      console.log("Error loading locations:", error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadSavedLocations();
      return () => {
        Speech.stop();
        setIsSpeakerSpeaking(false);
      };
    }, [])
  );

  // =================================
  // DELETE LOCATION
  // =================================
  const deleteLocation = async (locationId) => {
    Alert.alert(
      lang === "hi" ? "स्थान हटाएं" : lang === "bn" ? "অবস্থান মুছুন" : "Delete Location",
      lang === "hi" ? "क्या आप इस स्थान को हटाना चाहते हैं?" : lang === "bn" ? "আপনি কি এই অবস্থানটি মুছতে চান?" : "Are you sure you want to delete this location?",
      [
        { text: lang === "hi" ? "रद्द करें" : lang === "bn" ? "বাতিল" : "Cancel", style: "cancel" },
        {
          text: lang === "hi" ? "हटाएं" : lang === "bn" ? "মুছুন" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              const response = await fetch(`${BACKEND_API_URL}/${locationId}`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              if (response.ok) loadSavedLocations();
            } catch (error) {
              console.log("Error deleting location:", error);
            }
          },
        },
      ]
    );
  };

  // =======================================
  // SAVE LOCATION TO BACKEND
  // =======================================
  const saveLocationToBackend = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const nameToSave = farmName.trim() || "My Farm";

      const response = await fetch(BACKEND_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          locationName: nameToSave,
        }),
      });

      if (!response.ok) throw new Error("Save failed");

      const saved = await response.json();

      Alert.alert(
        lang === "hi" ? "सफलता" : lang === "bn" ? "সফল" : "Success",
        lang === "hi" ? "स्थान सहेजा गया!" : lang === "bn" ? "অবস্থান সংরক্ষিত হয়েছে!" : "Location saved!"
      );
      loadSavedLocations();

      if (saved?.location) {
        setLocation({
          ...saved.location,
          latitude: saved.location.latitude ?? coordinates.latitude,
          longitude: saved.location.longitude ?? coordinates.longitude,
        });
      }

    } catch (error) {
      console.log("Error saving location:", error);
      Alert.alert(
        lang === "hi" ? "त्रुटि" : lang === "bn" ? "ত্রুটি" : "Error",
        lang === "hi" ? "स्थान सहेजने में विफल" : lang === "bn" ? "অবস্থান সংরক্ষণ করা যায়নি" : "Failed to save location"
      );
      throw error;
    }
  };

  // ========================================
  // GET DEVICE GPS COORDINATES
  // ========================================
  const getDeviceCoordinates = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setPermissionDenied(true);
        return null;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
          accuracy: lastKnown.coords.accuracy || 100,
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 8000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      };
    } catch (error) {
      console.log("Error getting coordinates:", error);
      return null;
    }
  };

  // =============================================================
  // GEOCODE VIA BACKEND (Nominatim)
  // =============================================================
  const geocodeViaBackend = async (lat, lon) => {
    const token = await AsyncStorage.getItem("token");

    const response = await fetch(
      `${BACKEND_API_URL}/geocode?lat=${lat}&lon=${lon}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Geocoding failed");
    }

    const result = await response.json();
    return result.data;
  };

  // ================================================
  // UPDATE MAP
  // ================================================
  const updateMapWithCoordinates = (lat, lon) => {
    setMapRegion({
      latitude: lat,
      longitude: lon,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setShowMap(true);
  };

  // ================================================
  // VOICE ASSISTANT
  // ================================================
  const speak = (text) => {
    if (isMuted) return;
    Speech.stop();
    setIsSpeakerSpeaking(true);
    Speech.speak(text, {
      rate: 1.0,
      pitch: 1.0,
      language: lang === "hi" ? "hi-IN" : lang === "bn" ? "bn-IN" : "en-US",
      onDone: () => setIsSpeakerSpeaking(false),
      onError: () => setIsSpeakerSpeaking(false),
    });
  };

  const toggleMute = () => {
    if (!isMuted) {
      Speech.stop();
      setIsSpeakerSpeaking(false);
    }
    setIsMuted(!isMuted);
  };

  useEffect(() => {
    return () => {
      Speech.stop();
      speechInProgressRef.current = false;
    };
  }, []);

  useEffect(() => {
    Speech.stop();
    setIsSpeakerSpeaking(false);
    if (isMuted) return;
    if (apiError) speak(msg.serverError);
    else if (permissionDenied) speak(msg.permissionDenied);
  }, [apiError, permissionDenied, isMuted]);

  // =============================
  // AUTO LOCATION DETECTION
  // ✅ VOICE FIX: removed speak(msg.sendingToServer) from the middle
  // so "Using GPS" finishes playing before "Location found" fires.
  // GPS + geocoding takes ~2–5 seconds, enough time for the first
  // speech to complete naturally.
  // =============================
  const getLocation = async () => {
    if (Platform.OS !== "web") Vibration.vibrate(30);

    setIsGettingLocation(true);
    setPermissionDenied(false);
    setApiError(false);
    setShowMap(false);
    setLocationDetails(null);

    speak(msg.usingGPS);

    try {
      // Step 1: Get GPS coords from device
      const coords = await getDeviceCoordinates();

      if (!coords) {
        if (!permissionDenied) setApiError(true);
        setIsGettingLocation(false);
        return;
      }

      setCoordinates(coords);
      updateMapWithCoordinates(coords.latitude, coords.longitude);

      // ✅ REMOVED: speak(msg.sendingToServer) — was cutting off "Using GPS" speech

      // Step 2: Send to backend for Nominatim geocoding
      const addressData = await geocodeViaBackend(
        coords.latitude,
        coords.longitude
      );

      setLocationDetails(addressData);
      setSelectedLocation(null);

      setLocation({
        ...addressData,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
      });

      setTimeout(() => speak(msg.locationFound), 1500);

    } catch (error) {
      console.log("Location flow error:", error);
      setApiError(true);
      Alert.alert(msg.error, msg.serverError);
      speak(msg.locationFailed);
    } finally {
      setIsGettingLocation(false);
    }
  };

  // =============================
  // MANUAL ADDRESS SEARCH
  // =============================
  const handleManualSubmit = async () => {
    if (!manualAddress.trim()) {
      Alert.alert(msg.error, msg.pleaseFillFields);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSearchError("");
    setShowMap(false);
    setLocationDetails(null);

    try {
      const token = await AsyncStorage.getItem("token");
      const encoded = encodeURIComponent(manualAddress.trim());
      const response = await fetch(
        `${BACKEND_API_URL}/search?q=${encoded}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        setSearchError(
          lang === "hi" ? "कोई स्थान नहीं मिला। अधिक विशिष्ट पता आज़माएं।"
          : lang === "bn" ? "কোনো অবস্থান পাওয়া যায়নি। আরও নির্দিষ্ট ঠিকানা চেষ্টা করুন।"
          : "No locations found. Try a more specific address."
        );
        speak(lang === "hi" ? "कोई स्थान नहीं मिला। कृपया पुनः प्रयास करें।" : lang === "bn" ? "কোনো অবস্থান পাওয়া যায়নি। আবার চেষ্টা করুন।" : "No location found. Please try again.");
        return;
      }

      setSearchResults(data.data);
      speak(
        lang === "hi" ? `${data.data.length} परिणाम मिले। कृपया एक चुनें।`
        : lang === "bn" ? `${data.data.length}টি ফলাফল পাওয়া গেছে। একটি নির্বাচন করুন।`
        : `Found ${data.data.length} results. Please select one.`
      );

    } catch (error) {
      console.log("Manual search error:", error);
      setSearchError(
        lang === "hi" ? "खोज विफल रही। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।"
        : lang === "bn" ? "অনুসন্ধান ব্যর্থ হয়েছে। আপনার সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।"
        : "Search failed. Please check your connection and try again."
      );
      speak(lang === "hi" ? "स्थान नहीं मिला। कृपया सरल पता आज़माएं।" : lang === "bn" ? "অবস্থান খুঁজে পাওয়া যায়নি। সহজ ঠিকানা চেষ্টা করুন।" : "Could not find the location. Please try a simpler address.");
    } finally {
      setIsSearching(false);
    }
  };

  // =============================
  // SELECT A SEARCH RESULT
  // =============================
  const handleSelectSearchResult = (result) => {
    const coords = { latitude: result.latitude, longitude: result.longitude, accuracy: null };

    setCoordinates(coords);
    setLocationDetails({
      area: result.area, district: result.district, state: result.state,
      country: result.country || "India", village: result.village,
      pincode: result.pincode, fullAddress: result.fullAddress,
    });
    setSearchResults([]);
    setManualAddress(result.displayName || result.fullAddress);
    setSelectedLocation(null);

    updateMapWithCoordinates(result.latitude, result.longitude);

    setLocation({ ...result, latitude: result.latitude, longitude: result.longitude });

    speak(msg.locationFound);
  };

  // =============================
  // SELECT SAVED LOCATION
  // =============================
  const selectSavedLocation = (location) => {
    setSelectedLocation(location);
    setLocationDetails(null);

    const lat = location.latitude ?? location.coordinates?.latitude;
    const lon = location.longitude ?? location.coordinates?.longitude;

    setCoordinates({ latitude: lat, longitude: lon });
    updateMapWithCoordinates(lat, lon);
    setShowLocationMenu(false);

    setLocation({ ...location, latitude: lat, longitude: lon });
  };

  // =============================
  // CONFIRM LOCATION
  // =============================
  const confirmLocation = async () => {
    if (!coordinates) {
      Alert.alert(
        lang === "hi" ? "त्रुटि" : lang === "bn" ? "ত্রুটি" : "Error",
        lang === "hi" ? "पहले स्थान का पता लगाएं" : lang === "bn" ? "প্রথমে অবস্থান সনাক্ত করুন" : "Please detect location first"
      );
      return;
    }

    if (selectedLocation) {
      speak(msg.continue);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      return;
    }

    if (!farmName.trim()) {
      Alert.alert(
        msg.error,
        lang === "hi" ? "पुष्टि करने से पहले खेत का नाम दर्ज करें।"
        : lang === "bn" ? "নিশ্চিত করার আগে খামারের নাম লিখুন।"
        : "Please enter a farm name before confirming."
      );
      return;
    }

    try {
      await saveLocationToBackend();
      speak(msg.continue);
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (error) {
      // saveLocationToBackend already shows the alert
    }
  };

  // =============================
  // TEMPORARY SKIP
  // =============================

  // =============================
  // HELPERS
  // =============================
  const formatCoordinate = (val) => (val ? val.toFixed(6) : "");
  const formatAccuracy = (acc) => (acc ? `${acc.toFixed(2)} ${msg.meters}` : "");

  const isConfirmEnabled = () => {
    if (!coordinates) return false;
    if (selectedLocation) return true;
    return farmName.trim().length > 0;
  };

  // Auto-detect on mount once
  useEffect(() => {
    if (!isManualMode && !hasFetchedOnMount.current) {
      hasFetchedOnMount.current = true;
      getLocation();
    }
    return () => {
      Speech.stop();
      speechInProgressRef.current = false;
    };
  }, [isManualMode]);

  const displayLocation = (() => {
    if (selectedLocation) return selectedLocation.details || selectedLocation;
    return locationDetails;
  })();

  // ============================================
  // RENDER SAVED LOCATION ITEM
  // ============================================
  const renderLocationItem = ({ item }) => (
    <TouchableOpacity
      style={styles.menuLocationItem}
      onPress={() => selectSavedLocation(item)}
      activeOpacity={0.7}
    >
      <View style={styles.menuLocationIcon}>
        <Ionicons name="location" size={20} color="#2E7D32" />
      </View>
      <View style={styles.menuLocationInfo}>
        <Text style={styles.menuLocationName}>{item.locationName || item.name}</Text>
        <Text style={styles.menuLocationAddress} numberOfLines={1}>
          {item.address || `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}`}
        </Text>
      </View>
      <TouchableOpacity onPress={() => deleteLocation(item.id)} style={styles.menuLocationDelete}>
        <Ionicons name="close-circle" size={22} color="#999" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <ImageBackground
      source={require("../assets/locationbg.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(210, 243, 144, 0.5)",
      }} />

      <SafeAreaView style={{ flex: 1 }}>

        {/* Hamburger Menu */}
        <View style={styles.hamburgerContainer}>
          <TouchableOpacity style={styles.hamburgerButton} onPress={() => setShowLocationMenu(true)}>
            <Ionicons name="menu" size={28} color="#2E7D32" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }} keyboardShouldPersistTaps="handled">

            {/* Title */}
            <View style={styles.locationIconContainer}>
              <LinearGradient colors={["#2E7D32", "#1B5E20"]} style={styles.iconGradient}>
                <Ionicons name="compass" size={40} color="#fff" />
              </LinearGradient>
              <Text style={styles.titleText}>{msg.selectLocation}</Text>
            </View>

            {/* Temporary Skip Button */}

            {/* Loading */}
            {isGettingLocation && (
              <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <View style={{
                  backgroundColor: "#E3F2FD", padding: 15, borderRadius: 10,
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                }}>
                  <ActivityIndicator size="small" color="#1976D2" />
                  <Text style={{ marginLeft: 10, color: "#1976D2", fontWeight: "600" }}>
                    {msg.sendingToServer}
                  </Text>
                </View>
              </View>
            )}

            {/* API Error */}
            {apiError && !isGettingLocation && (
              <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <View style={{
                  backgroundColor: "#FFEBEE", padding: 20, borderRadius: 10,
                  borderWidth: 1, borderColor: "#FF5252", alignItems: "center",
                }}>
                  <Ionicons name="alert-circle" size={40} color="#D32F2F" />
                  <Text style={{ color: "#D32F2F", textAlign: "center", fontSize: 16, marginTop: 10, marginBottom: 15 }}>
                    {msg.serverError}
                  </Text>
                  <TouchableOpacity
                    onPress={isManualMode ? handleManualSubmit : getLocation}
                    style={{
                      backgroundColor: "#2196F3", paddingVertical: 12, paddingHorizontal: 30,
                      borderRadius: 8, flexDirection: "row", alignItems: "center",
                    }}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                      {isManualMode ? (lang === "hi" ? "फिर खोजें" : lang === "bn" ? "আবার খুঁজুন" : "Search Again") : msg.retryButton}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Permission Denied */}
            {permissionDenied && !isGettingLocation && !apiError && (
              <View style={{ paddingHorizontal: 20, marginBottom: 10 }}>
                <View style={{ backgroundColor: "#FFEBEE", padding: 20, borderRadius: 10, alignItems: "center" }}>
                  <Ionicons name="ban" size={40} color="#FF5252" />
                  <Text style={{ color: "#D32F2F", textAlign: "center", marginTop: 10, fontSize: 16, marginBottom: 15 }}>
                    {msg.permissionDenied}
                  </Text>
                  <TouchableOpacity
                    onPress={getLocation}
                    style={{
                      backgroundColor: "#2196F3", paddingVertical: 12, paddingHorizontal: 30,
                      borderRadius: 8, flexDirection: "row", alignItems: "center",
                    }}
                  >
                    <Ionicons name="refresh" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>{msg.retry}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Main Content */}
            {!apiError && !permissionDenied && (
              <View style={{ paddingHorizontal: 20 }}>

                {/* Mode Toggle */}
                <View style={{ marginBottom: 20 }}>
                  <View style={{ flexDirection: "row", backgroundColor: "#fff", borderRadius: 15, padding: 5, elevation: 3 }}>
                    {[
                      { label: msg.detectAutomatically, icon: "locate", manual: false },
                      { label: msg.enterManually, icon: "create", manual: true },
                    ].map(({ label, icon, manual }) => (
                      <TouchableOpacity
                        key={label}
                        onPress={() => {
                          setIsManualMode(manual);
                          setSearchResults([]);
                          setSearchError("");
                          setLocationDetails(null);
                          setShowMap(false);
                          setCoordinates(null);
                          setSelectedLocation(null);
                          setFarmName("");
                        }}
                        style={{
                          flex: 1, paddingVertical: 12, borderRadius: 12,
                          backgroundColor: isManualMode === manual ? "#2E7D32" : "transparent",
                          alignItems: "center", flexDirection: "row", justifyContent: "center",
                        }}
                      >
                        <Ionicons name={icon} size={18} color={isManualMode === manual ? "#fff" : "#666"} style={{ marginRight: 6 }} />
                        <Text style={{ fontWeight: "bold", color: isManualMode === manual ? "#fff" : "#666" }}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Manual Mode */}
                {isManualMode ? (
                  <View style={{
                    backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 25,
                    padding: 25, elevation: 8, borderWidth: 1, borderColor: "#4CAF50", marginBottom: 20,
                  }}>
                    <Text style={{ fontSize: 20, fontWeight: "bold", color: "#1B5E20", marginBottom: 15, textAlign: "center" }}>
                      {msg.enterManuallyTitle}
                    </Text>

                    <View style={{
                      flexDirection: "row", alignItems: "center",
                      backgroundColor: "#F5F5F5", borderRadius: 12,
                      borderWidth: 1, borderColor: "#4CAF50",
                      marginBottom: 10, paddingRight: 8,
                    }}>
                      <TextInput
                        style={{ flex: 1, padding: 14, fontSize: 15, color: "#333" }}
                        placeholder="e.g. 7A Cornfield Rd, Ballygunge, Kolkata 700019"
                        placeholderTextColor="#999"
                        value={manualAddress}
                        onChangeText={(v) => {
                          setManualAddress(v);
                          setSearchError("");
                          setSearchResults([]);
                        }}
                        multiline={false}
                        returnKeyType="search"
                        onSubmitEditing={handleManualSubmit}
                      />
                      {manualAddress.length > 0 && (
                        <TouchableOpacity
                          onPress={() => {
                            setManualAddress("");
                            setSearchResults([]);
                            setSearchError("");
                            setLocationDetails(null);
                            setShowMap(false);
                          }}
                          style={{ padding: 6 }}
                        >
                          <Ionicons name="close-circle" size={20} color="#999" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={{ fontSize: 12, color: "#888", marginBottom: 14, marginLeft: 4 }}>
                      {lang === "hi" ? "पूरे पते, इलाके या जिला नाम के साथ काम करता है"
                      : lang === "bn" ? "পূর্ণ ঠিকানা, এলাকা বা জেলার নামের সাথে কাজ করে"
                      : "Works with full addresses, street names, localities, or just area + district"}
                    </Text>

                    <TouchableOpacity
                      onPress={handleManualSubmit}
                      disabled={isSearching || !manualAddress.trim()}
                      style={{
                        backgroundColor: isSearching || !manualAddress.trim() ? "#A5D6A7" : "#FF9800",
                        padding: 14, borderRadius: 12, alignItems: "center",
                        flexDirection: "row", justifyContent: "center", marginBottom: 10,
                      }}
                    >
                      {isSearching ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>
                            {lang === "hi" ? "खोजा जा रहा है..." : lang === "bn" ? "খোঁজা হচ্ছে..." : "Searching..."}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="search" size={20} color="#fff" style={{ marginRight: 8 }} />
                          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>{msg.findOnMap}</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {searchError ? (
                      <View style={{
                        backgroundColor: "#FFF3E0", borderRadius: 10, padding: 12,
                        borderWidth: 1, borderColor: "#FF9800", marginTop: 4,
                      }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                          <Ionicons name="alert-circle" size={16} color="#E65100" style={{ marginRight: 6 }} />
                          <Text style={{ color: "#E65100", fontSize: 13, fontWeight: "600", flex: 1 }}>
                            {searchError}
                          </Text>
                        </View>
                        <Text style={{ color: "#795548", fontSize: 12, lineHeight: 18 }}>
                          💡 Try: "Ballygunge, Kolkata" or "Darjeeling, West Bengal 734101"
                        </Text>
                      </View>
                    ) : null}

                    {searchResults.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ fontWeight: "600", color: "#1B5E20", marginBottom: 8, fontSize: 14 }}>
                          {lang === "hi" ? "अपना स्थान चुनें:" : lang === "bn" ? "আপনার অবস্থান নির্বাচন করুন:" : "Select your location:"}
                        </Text>
                        {searchResults.map((result, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => handleSelectSearchResult(result)}
                            style={{
                              flexDirection: "row", alignItems: "flex-start",
                              backgroundColor: "#F1F8E9", borderRadius: 10,
                              padding: 12, marginBottom: 8,
                              borderWidth: 1, borderColor: "#A5D6A7",
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="location" size={18} color="#2E7D32" style={{ marginTop: 2, marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: "700", color: "#1B5E20", marginBottom: 2 }}>
                                {result.city || result.district || result.village || "Location"}
                                {result.district && result.city && result.district !== result.city ? `, ${result.district}` : ""}
                              </Text>
                              <Text style={{ fontSize: 12, color: "#555" }}>
                                {[result.state, result.pincode].filter(Boolean).join(" — ")}
                              </Text>
                              <Text style={{ fontSize: 11, color: "#888", marginTop: 2 }} numberOfLines={2}>
                                {result.fullAddress}
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#2E7D32" style={{ marginTop: 2 }} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  !locationDetails && !isGettingLocation && (
                    <TouchableOpacity
                      onPress={getLocation}
                      style={{
                        backgroundColor: "#2196F3", padding: 15, borderRadius: 12,
                        flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20,
                      }}
                    >
                      <Ionicons name="locate" size={24} color="#fff" />
                      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16, marginLeft: 10 }}>
                        {msg.getLocationButton}
                      </Text>
                    </TouchableOpacity>
                  )
                )}

                {/* Farm Name Input */}
                {locationDetails && !isGettingLocation && !selectedLocation && (
                  <View style={{
                    backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 25,
                    padding: 20, elevation: 8, borderWidth: 1, borderColor: "#4CAF50", marginBottom: 20,
                  }}>
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#1B5E20", marginBottom: 10 }}>
                      {msg.enterFarmName} <Text style={{ color: "red" }}>*</Text>
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#F5F5F5", borderRadius: 10, padding: 15, fontSize: 16, color: "#333",
                        borderWidth: 1, borderColor: farmName.trim() ? "#4CAF50" : "#E0E0E0",
                      }}
                      placeholder={msg.enterNameForLocation}
                      placeholderTextColor="#999"
                      value={farmName}
                      onChangeText={setFarmName}
                    />
                  </View>
                )}

                {/* Map */}
                {showMap && mapRegion && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, color: "#1B5E20", fontWeight: "600", marginBottom: 8, marginLeft: 5 }}>
                      {msg.locationOnMap}
                    </Text>
                    <View style={{ height: 250, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: "#4CAF50", elevation: 5 }}>
                      {isGettingLocation ? (
                        <View style={{ flex: 1, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" }}>
                          <ActivityIndicator size="large" color="#2E7D32" />
                          <Text style={{ marginTop: 10, color: "#666" }}>{msg.mapLoading}</Text>
                        </View>
                      ) : (
                        <MapView
                          style={{ flex: 1 }}
                          provider={PROVIDER_GOOGLE}
                          region={mapRegion}
                          showsUserLocation={true}
                          showsMyLocationButton={false}
                        >
                          <Marker coordinate={mapRegion}>
                            <View style={{ alignItems: "center" }}>
                              <View style={{
                                backgroundColor: "#FF6B6B", width: 30, height: 30, borderRadius: 15,
                                borderWidth: 3, borderColor: "#FFFFFF", elevation: 5,
                              }} />
                              <View style={{ width: 4, height: 10, backgroundColor: "#FF6B6B", marginTop: -2 }} />
                              <Text style={{
                                fontSize: 12, fontWeight: "bold", color: "#333", marginTop: 4,
                                backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: 8,
                                paddingVertical: 2, borderRadius: 10,
                              }}>
                                {msg.youAreHere}
                              </Text>
                            </View>
                          </Marker>
                        </MapView>
                      )}
                      <View style={{
                        position: "absolute", top: 10, right: 10,
                        backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 12,
                        paddingVertical: 6, borderRadius: 15, flexDirection: "row", alignItems: "center",
                      }}>
                        <Ionicons name="radio" size={12} color="#4CAF50" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 10, fontWeight: "bold", color: "#333" }}>LIVE</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Location Details Card */}
                {/* ✅ "City" label changed to "Area" (msg.areaLabel) */}
                {displayLocation && !isGettingLocation && (
                  <View style={{
                    backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 25,
                    padding: 20, elevation: 8, borderWidth: 1, borderColor: "#4CAF50", marginBottom: 20,
                  }}>
                    <Text style={{ fontSize: 20, fontWeight: "bold", color: "#1B5E20", marginBottom: 20, textAlign: "center" }}>
                      {msg.locationFound}
                    </Text>

                    {[
                      { label: msg.areaLabel,    value: displayLocation.area },
                      { label: msg.districtLabel, value: displayLocation.district },
                      { label: msg.stateLabel,    value: displayLocation.state },
                      { label: msg.countryLabel,  value: displayLocation.country },
                    ].map(({ label, value }) => (
                      <View key={label} style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{label}</Text>
                        <View style={{ backgroundColor: "#F5F5F5", borderRadius: 10, padding: 14 }}>
                          <Text style={{ fontSize: 16, color: "#333", fontWeight: "600" }}>{value || "-"}</Text>
                        </View>
                      </View>
                    ))}

                    {coordinates && (
                      <View style={{ flexDirection: "row", marginBottom: 12 }}>
                        {[
                          { label: msg.latitudeLabel,  value: coordinates.latitude },
                          { label: msg.longitudeLabel, value: coordinates.longitude },
                        ].map(({ label, value }) => (
                          <View key={label} style={{ flex: 1, marginHorizontal: 3 }}>
                            <Text style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</Text>
                            <View style={{ backgroundColor: "#E8F5E9", borderRadius: 8, padding: 10 }}>
                              <Text style={{ fontSize: 14, color: "#2E7D32", fontWeight: "600" }}>
                                {formatCoordinate(value)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={isManualMode ? handleManualSubmit : getLocation}
                      style={{ padding: 14, alignItems: "center", marginTop: 12, flexDirection: "row", justifyContent: "center" }}
                    >
                      <Ionicons name="refresh" size={20} color="#2E7D32" style={{ marginRight: 6 }} />
                      <Text style={{ color: "#2E7D32", fontWeight: "600" }}>
                        {isManualMode ? (lang === "hi" ? "फिर खोजें" : lang === "bn" ? "আবার খুঁজুন" : "Search Again") : msg.detectAgain}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Confirm Button */}
                {(locationDetails || selectedLocation) && (
                  <TouchableOpacity
                    onPress={confirmLocation}
                    disabled={!isConfirmEnabled()}
                    style={{
                      borderRadius: 15, overflow: "hidden",
                      marginTop: 10, marginBottom: 20,
                      opacity: isConfirmEnabled() ? 1 : 0.5,
                    }}
                  >
                    <LinearGradient
                      colors={isConfirmEnabled() ? ["#2E7D32", "#1B5E20"] : ["#999", "#666"]}
                      style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center" }}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 18 }}>{msg.confirmLocation}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}

              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Location Menu Modal */}
      <Modal visible={showLocationMenu} animationType="slide" transparent onRequestClose={() => setShowLocationMenu(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>{msg.otherAddresses}</Text>
              <TouchableOpacity onPress={() => setShowLocationMenu(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {savedLocations.length > 0 ? (
              <FlatList
                data={savedLocations}
                renderItem={renderLocationItem}
                keyExtractor={(item) => item.id?.toString()}
                contentContainerStyle={styles.menuList}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyMenu}>
                <Ionicons name="location-outline" size={50} color="#ccc" />
                <Text style={styles.emptyMenuText}>
                  {lang === "hi" ? "अभी कोई स्थान नहीं" : lang === "bn" ? "এখনো কোনো অবস্থান নেই" : "No saved locations yet"}
                </Text>
                <TouchableOpacity
                  style={styles.addFirstLocationBtn}
                  onPress={() => { setShowLocationMenu(false); getLocation(); }}
                >
                  <Text style={styles.addFirstLocationText}>
                    {lang === "hi" ? "पहला स्थान जोड़ें" : lang === "bn" ? "প্রথম অবস্থান যোগ করুন" : "Add your first location"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.menuAddButton}
              onPress={() => { setShowLocationMenu(false); getLocation(); }}
            >
              <Ionicons name="add-circle" size={24} color="#2E7D32" />
              <Text style={styles.menuAddText}>{msg.addNewLocation}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Speaker Button */}
      <View style={styles.speakerFixedContainer}>
        <TouchableOpacity
          style={[styles.speakerButton, isMuted ? styles.mutedButton : styles.activeButton]}
          onPress={toggleMute}
          activeOpacity={0.7}
        >
          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={24} color="#fff" />
        </TouchableOpacity>
        {isSpeakerSpeaking && !isMuted && (
          <View style={styles.waveContainer}>
            <View style={styles.wave1} />
            <View style={styles.wave2} />
            <View style={styles.wave3} />
          </View>
        )}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  speakerFixedContainer: {
    position: "absolute", bottom: 20, left: 20,
    flexDirection: "row", alignItems: "center", zIndex: 1000, elevation: 10,
  },
  speakerButton: {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  activeButton: { backgroundColor: "#2E7D32" },
  mutedButton: { backgroundColor: "#D32F2F" },
  waveContainer: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  wave1: { width: 4, height: 12, backgroundColor: "#2E7D32", marginHorizontal: 2, borderRadius: 2, opacity: 0.7 },
  wave2: { width: 4, height: 20, backgroundColor: "#2E7D32", marginHorizontal: 2, borderRadius: 2, opacity: 1 },
  wave3: { width: 4, height: 12, backgroundColor: "#2E7D32", marginHorizontal: 2, borderRadius: 2, opacity: 0.7 },
  hamburgerContainer: { position: "absolute", top: 50, left: 15, zIndex: 100 },
  hamburgerButton: {
    padding: 8, backgroundColor: "#fff", borderRadius: 8, elevation: 3,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  locationIconContainer: { alignItems: "center", marginTop: 25, marginBottom: 20 },
  iconGradient: { padding: 15, borderRadius: 50, marginBottom: 15, elevation: 8 },
  titleText: { fontSize: 26, fontWeight: "bold", color: "#1B5E20", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  menuContainer: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "80%", paddingTop: 20,
  },
  menuHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#e0e0e0",
  },
  menuTitle: { fontSize: 20, fontWeight: "bold", color: "#2E7D32" },
  menuList: { padding: 15 },
  menuLocationItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f9f9f9",
    borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#e0e0e0",
  },
  menuLocationIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8F5E9",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  menuLocationInfo: { flex: 1 },
  menuLocationName: { fontSize: 15, fontWeight: "600", color: "#333", marginBottom: 2 },
  menuLocationAddress: { fontSize: 12, color: "#666" },
  menuLocationDelete: { padding: 4 },
  emptyMenu: { padding: 40, alignItems: "center" },
  emptyMenuText: { marginTop: 10, fontSize: 16, color: "#999", marginBottom: 15 },
  addFirstLocationBtn: { backgroundColor: "#2E7D32", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  addFirstLocationText: { color: "#fff", fontWeight: "600" },
  menuAddButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 15, borderTopWidth: 1, borderTopColor: "#e0e0e0", marginTop: 10,
  },
  menuAddText: { fontSize: 16, fontWeight: "600", color: "#2E7D32", marginLeft: 8 },
});

export default LocationScreen;