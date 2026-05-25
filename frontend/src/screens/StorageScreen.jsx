import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, ImageBackground, Alert, Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { AppContext } from '../context/AppContext';
import { BASE_URL } from '../api/apiClient';

const API_BASE_URL = BASE_URL;

const UI = {
  en: {
    step1Title: 'Which harvest do you want to store?',
    step1Sub: 'Select from your recorded harvests',
    noHarvests: 'No harvests recorded yet.\n\nGo to My Crop → when your crop is 100% ready → tap "Harvest Crop" to record it first.',
    step2Title: 'Cold Storages Near You',
    step2Sub: 'Showing storages that accept your crop',
    noStorages: 'No cold storages found nearby for this crop within 50 km.',
    tryAgain: 'Try Again', back: 'Back', backToList: 'Back to List',
    km: 'km', capacity: 'Capacity', mt: 'MT', stores: 'Stores:',
    loading: 'Loading...', findingStorages: 'Finding cold storages near you...',
    qty: 'Quantity', date: 'Harvested on',
    ownerContact: 'Owner Contact', address: 'Address',
    district: 'District', storedCrops: 'Stored Crops',
    callOwner: 'Call Owner', getDirections: 'Open in Google Maps',
    listenBtn: 'Listen', stopBtn: 'Stop',
    registeredUnder: 'Registered Under',
    foundStorageQuestion: 'Did you find storage for',
    foundStorageYes: 'Yes, Found Storage',
    foundStorageNo: 'Not Yet',
    foundStorageSuccess: 'Great! This harvest has been removed from your list.',
    mapPreviewTitle: 'Storage Location',
    straightLineNote: '(straight-line distance)',
  },
  hi: {
    step1Title: 'कौन सी फसल स्टोर करनी है?',
    step1Sub: 'दर्ज की गई फसलों में से चुनें',
    noHarvests: 'अभी कोई फसल दर्ज नहीं है।\n\nमेरी फसल → 100% तैयार हो → "फसल काटें" पर टैप करें।',
    step2Title: 'आपके पास कोल्ड स्टोरेज',
    step2Sub: 'आपकी फसल रखने वाले स्टोरेज',
    noStorages: 'इस फसल के लिए 50 km में कोई कोल्ड स्टोरेज नहीं मिला।',
    tryAgain: 'फिर कोशिश करें', back: 'वापस', backToList: 'सूची पर वापस',
    km: 'km', capacity: 'क्षमता', mt: 'MT', stores: 'रखता है:',
    loading: 'लोड हो रहा है...', findingStorages: 'कोल्ड स्टोरेज खोजे जा रहे हैं...',
    qty: 'मात्रा', date: 'फसल तारीख',
    ownerContact: 'मालिक का संपर्क', address: 'पता',
    district: 'जिला', storedCrops: 'रखी जाने वाली फसलें',
    callOwner: 'मालिक को कॉल करें', getDirections: 'Google Maps में खोलें',
    listenBtn: 'सुनें', stopBtn: 'रोकें',
    registeredUnder: 'पंजीकृत',
    foundStorageQuestion: 'क्या आपको इस फसल के लिए स्टोरेज मिल गया?',
    foundStorageYes: 'हाँ, मिल गया',
    foundStorageNo: 'अभी नहीं',
    foundStorageSuccess: 'बढ़िया! यह फसल आपकी सूची से हटा दी गई है।',
    mapPreviewTitle: 'स्टोरेज का स्थान',
    straightLineNote: '(सीधी दूरी)',
  },
  bn: {
    step1Title: 'কোন ফসল সংরক্ষণ করতে চান?',
    step1Sub: 'নথিভুক্ত ফসল থেকে বেছে নিন',
    noHarvests: 'এখনো কোনো ফসল নথিভুক্ত নেই।\n\nআমার ফসল → ১০০% প্রস্তুত হলে → "ফসল কাটুন" ট্যাপ করুন।',
    step2Title: 'আপনার কাছের কোল্ড স্টোরেজ',
    step2Sub: 'আপনার ফসল সংরক্ষণ করে এমন স্টোরেজ',
    noStorages: 'এই ফসলের জন্য ৫০ কিমির মধ্যে কোনো কোল্ড স্টোরেজ পাওয়া যায়নি।',
    tryAgain: 'আবার চেষ্টা করুন', back: 'ফিরে যান', backToList: 'তালিকায় ফিরুন',
    km: 'km', capacity: 'ধারণক্ষমতা', mt: 'MT', stores: 'সংরক্ষণ করে:',
    loading: 'লোড হচ্ছে...', findingStorages: 'কোল্ড স্টোরেজ খোঁজা হচ্ছে...',
    qty: 'পরিমাণ', date: 'ফসল কাটার তারিখ',
    ownerContact: 'মালিকের যোগাযোগ', address: 'ঠিকানা',
    district: 'জেলা', storedCrops: 'সংরক্ষিত ফসল',
    callOwner: 'মালিককে কল করুন', getDirections: 'Google Maps-এ খুলুন',
    listenBtn: 'শুনুন', stopBtn: 'থামুন',
    registeredUnder: 'নিবন্ধিত',
    foundStorageQuestion: 'এই ফসলের জন্য কি স্টোরেজ পেয়েছেন?',
    foundStorageYes: 'হ্যাঁ, পেয়েছি',
    foundStorageNo: 'এখনো না',
    foundStorageSuccess: 'চমৎকার! এই ফসল আপনার তালিকা থেকে সরানো হয়েছে।',
    mapPreviewTitle: 'স্টোরেজের অবস্থান',
    straightLineNote: '(সরলরেখার দূরত্ব)',
  },
};

const speechLang = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN' };

const DetailRow = ({ icon, label, value }) => (
  <View style={styles.detailRow}>
    <Ionicons name={icon} size={20} color="#2E7D32" style={{ marginTop: 2 }} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

export default function StorageScreen({ navigation }) {
  const { lang } = useContext(AppContext);
  const t = UI[lang] || UI.en;

  const [step, setStep] = useState(1);
  const [harvests, setHarvests] = useState([]);
  const [loadingHarvests, setLoadingHarvests] = useState(true);
  const [selectedHarvest, setSelectedHarvest] = useState(null);
  const [storages, setStorages] = useState([]);
  const [loadingStorages, setLoadingStorages] = useState(false);
  const [storageError, setStorageError] = useState(null);
  const [selectedStorage, setSelectedStorage] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [markingStored, setMarkingStored] = useState(false);
  const [markedStored, setMarkedStored] = useState(false);

  const getToken = () => AsyncStorage.getItem('token');

  // Override header back arrow: steps 2 and 3 go to previous step
  useEffect(() => {
    if (step === 1) {
      navigation.setOptions({ headerLeft: undefined });
    } else {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity onPress={goBack} style={{ marginLeft: 10, padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
        ),
      });
    }
  }, [step]);

  useEffect(() => { loadHarvests(); }, []);

  const loadHarvests = async () => {
    setLoadingHarvests(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/harvest/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setHarvests(data.harvests || []);
      else Alert.alert('Error', data.message || 'Could not load harvests');
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoadingHarvests(false);
    }
  };

  const handleSelectHarvest = async (harvest) => {
    setSelectedHarvest(harvest);
    setStorageError(null);
    setStorages([]);
    setLoadingStorages(true);
    setMarkedStored(false);
    setStep(2);
    try {
      const token = await getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/cold-storage/nearby?harvestId=${harvest.id}&lang=${lang}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data.success) {
        setStorages(data.coldStorages || []);
        if (data.coldStorages?.length > 0) {
          const n = data.coldStorages.length;
          speakText(lang === 'hi' ? `${n} कोल्ड स्टोरेज मिले` : lang === 'bn' ? `${n}টি কোল্ড স্টোরেজ পাওয়া গেছে` : `Found ${n} cold storages near you`);
        }
      } else {
        setStorageError(data.message || t.noStorages);
      }
    } catch {
      setStorageError(t.noStorages);
    } finally {
      setLoadingStorages(false);
    }
  };

  const handleSelectStorage = async (storage) => {
    setLoadingDetail(true);
    setSelectedStorage(null);
    setMarkedStored(false);
    setStep(3);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/cold-storage/${storage.id}?lang=${lang}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedStorage(data.coldStorage);
        const cs = data.coldStorage;
        speakText(lang === 'hi' ? `${cs.name}। दूरी ${cs.distanceFormatted || ''}। संपर्क ${cs.ownerContact}` :
                  lang === 'bn' ? `${cs.name}। দূরত্ব ${cs.distanceFormatted || ''}। যোগাযোগ ${cs.ownerContact}` :
                  `${cs.name}. Distance ${cs.distanceFormatted || ''}. Contact ${cs.ownerContact}`);
      } else { Alert.alert('Error', data.message); setStep(2); }
    } catch { Alert.alert('Error', 'Could not load details'); setStep(2); }
    finally { setLoadingDetail(false); }
  };

  // ✅ FIXED: redirect happens inside onDone/onError of speech so voice
  // always finishes completely before going back to step 1.
  // The old markedStored useEffect with 2000ms timeout was cutting off
  // Bengali speech which takes longer than 2 seconds.
  const resetToStep1 = () => {
    setSpeaking(false);
    setStep(1);
    setSelectedHarvest(null);
    setSelectedStorage(null);
    setMarkedStored(false);
  };

  const handleFoundStorage = async () => {
    if (!selectedHarvest) return;
    setMarkingStored(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}/api/harvest/${selectedHarvest.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMarkedStored(true);
        setHarvests(prev => prev.filter(h => h.id !== selectedHarvest.id));
        const text = lang === 'hi' ? 'बढ़िया! फसल सूची से हटा दी गई है।' :
                     lang === 'bn' ? 'চমৎকার! ফসল তালিকা থেকে সরানো হয়েছে।' :
                     'Great! Harvest removed from your list.';
        Speech.stop();
        setSpeaking(true);
        // ✅ Redirect ONLY after speech finishes — onDone fires when done,
        // onError fires if speech engine fails (still redirects cleanly)
        Speech.speak(text, {
          language: speechLang[lang] || 'en-IN',
          rate: 0.9,
          onDone:  resetToStep1,
          onError: resetToStep1,
        });
      } else {
        Alert.alert('Error', data.message || 'Could not update record');
      }
    } catch {
      Alert.alert('Error', 'Network error');
    } finally {
      setMarkingStored(false);
    }
  };

  // ✅ REMOVED: markedStored useEffect with fixed 2000ms timeout deleted.
  // Redirect is now handled by onDone callback in handleFoundStorage above.

  const speakText = (text) => {
    Speech.stop(); setSpeaking(true);
    Speech.speak(text, { language: speechLang[lang] || 'en-IN', rate: 0.9, onDone: () => setSpeaking(false), onError: () => setSpeaking(false) });
  };

  const handleSpeak = () => {
    if (speaking) { Speech.stop(); setSpeaking(false); return; }
    if (step === 3 && selectedStorage) {
      const cs = selectedStorage;
      const crops = (cs.storedCrops || []).map(c => typeof c === 'string' ? c : c.name).join(', ');
      speakText(lang === 'hi' ? `${cs.name}। पता: ${cs.address}। जिला: ${cs.district}। फसलें: ${crops}। संपर्क: ${cs.ownerContact}` :
               lang === 'bn' ? `${cs.name}। ঠিকানা: ${cs.address}। জেলা: ${cs.district}। ফসল: ${crops}। যোগাযোগ: ${cs.ownerContact}` :
               `${cs.name}. Address: ${cs.address}. District: ${cs.district}. Crops: ${crops}. Contact: ${cs.ownerContact}`);
    }
  };

  const goBack = () => { Speech.stop(); setSpeaking(false); if (step > 1) setStep(step - 1); };
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const formatQty = (kg) => { if (!kg) return ''; if (kg >= 1000) return `${(kg/1000).toFixed(1)} ton`; if (kg >= 100) return `${(kg/100).toFixed(1)} quintal`; return `${kg} kg`; };

  const openGoogleMaps = () => {
    const lat = selectedStorage?.coordinates?.latitude;
    const lon = selectedStorage?.coordinates?.longitude;
    if (lat && lon) {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`);
    }
  };

  return (
    <ImageBackground source={require('../assets/storagebg.jpg')} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>

        {/* ── Step 1: Pick harvest ── */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{t.step1Title}</Text>
            <Text style={styles.stepSub}>{t.step1Sub}</Text>
            {loadingHarvests ? (
              <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 40 }} />
            ) : harvests.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialCommunityIcons name="warehouse" size={60} color="rgba(255,255,255,0.5)" />
                <Text style={styles.emptyText}>{t.noHarvests}</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {harvests.map((h) => (
                  <TouchableOpacity key={h.id} style={styles.harvestCard} onPress={() => handleSelectHarvest(h)} activeOpacity={0.75}>
                    <View style={styles.harvestCardLeft}>
                      <MaterialCommunityIcons name="sprout" size={28} color="#2E7D32" />
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.harvestCropName}>{h.cropName}</Text>
                        {/* ✅ CHANGED: use h.notes (e.g. "10 quintal") instead of converting from kg */}
                        <Text style={styles.harvestMeta}>{t.qty}: {h.notes || formatQty(h.quantity)}</Text>
                        <Text style={styles.harvestMeta}>{t.date}: {formatDate(h.harvestDate)}</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color="#2E7D32" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── Step 2: Cold storage list ── */}
        {step === 2 && (
          <View style={styles.fullContainer}>
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>{t.step2Title}</Text>
              {/* ✅ CHANGED: use selectedHarvest.notes instead of converting from kg */}
              <Text style={styles.listSub}>{selectedHarvest?.cropName} — {selectedHarvest?.notes || formatQty(selectedHarvest?.quantity)}</Text>
            </View>
            {loadingStorages ? (
              <View style={styles.centered}><ActivityIndicator size="large" color="#2E7D32" /><Text style={styles.loadingText}>{t.findingStorages}</Text></View>
            ) : storageError ? (
              <View style={styles.centered}>
                <Ionicons name="cloud-offline-outline" size={60} color="#ccc" />
                <Text style={styles.errorText}>{storageError}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleSelectHarvest(selectedHarvest)}><Text style={styles.primaryBtnText}>{t.tryAgain}</Text></TouchableOpacity>
              </View>
            ) : storages.length === 0 ? (
              <View style={styles.centered}><Ionicons name="sad-outline" size={60} color="#ccc" /><Text style={styles.errorText}>{t.noStorages}</Text></View>
            ) : (
              <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                {storages.map((cs) => (
                  <TouchableOpacity key={cs.id} style={styles.storageCard} onPress={() => handleSelectStorage(cs)} activeOpacity={0.75}>
                    <View style={styles.storageCardTop}>
                      <Text style={styles.storageName} numberOfLines={2}>{cs.name}</Text>
                      <View style={styles.distanceBadge}>
                        <Ionicons name="location" size={12} color="#2E7D32" />
                        <Text style={styles.distanceText}>{cs.distanceFormatted || `${cs.distance} ${t.km}`}</Text>
                      </View>
                    </View>
                    <Text style={styles.storageDistrict}>{cs.district}</Text>
                    <View style={styles.cropsRow}>
                      <Text style={styles.storesLabel}>{t.stores} </Text>
                      <Text style={styles.cropsText} numberOfLines={1}>{(cs.storedCrops || []).join(', ')}</Text>
                    </View>
                    <View style={styles.storageFooter}>
                      <Text style={styles.capacityText}>{t.capacity}: {cs.capacity} {t.mt}</Text>
                      <Ionicons name="chevron-forward" size={18} color="#2E7D32" />
                    </View>
                  </TouchableOpacity>
                ))}
                <View style={{ height: 80 }} />
              </ScrollView>
            )}
            <TouchableOpacity style={styles.floatingBack} onPress={goBack}>
              <Ionicons name="arrow-back" size={20} color="#2E7D32" />
              <Text style={styles.floatingBackText}>{t.back}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Step 3: Cold storage detail ── */}
        {step === 3 && (
          <View style={styles.fullContainer}>
            {loadingDetail ? (
              <View style={styles.centered}><ActivityIndicator size="large" color="#2E7D32" /><Text style={styles.loadingText}>{t.loading}</Text></View>
            ) : selectedStorage ? (
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>

                <View style={styles.detailHeader}>
                  <Text style={styles.detailName}>{selectedStorage.name}</Text>
                  {selectedStorage.distanceFormatted && (
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.distanceBadgeLarge}>
                        <Ionicons name="location" size={16} color="#2E7D32" />
                        <Text style={styles.distanceBadgeLargeText}>{selectedStorage.distanceFormatted}</Text>
                      </View>
                      <Text style={styles.straightLineNote}>{t.straightLineNote}</Text>
                    </View>
                  )}
                  {selectedStorage.registeredUnder && (
                    <Text style={styles.registeredText}>{selectedStorage.registeredUnder}</Text>
                  )}
                </View>

                <View style={styles.detailCard}>
                  <DetailRow icon="call-outline"     label={t.ownerContact} value={selectedStorage.ownerContact} />
                  <DetailRow icon="location-outline" label={t.address}      value={selectedStorage.address} />
                  <DetailRow icon="business-outline" label={t.district}     value={`${selectedStorage.district}, ${selectedStorage.state}`} />
                  <DetailRow icon="cube-outline"     label={t.capacity}     value={`${selectedStorage.capacity} ${t.mt}`} />
                  <DetailRow icon="leaf-outline"     label={t.storedCrops}  value={(selectedStorage.storedCrops || []).map(c => typeof c === 'string' ? c : c.name).join(', ')} />
                </View>

                {selectedStorage.coordinates?.latitude && selectedStorage.coordinates?.longitude && (
                  <View style={styles.mapCard}>
                    <Text style={styles.mapCardTitle}>
                      <Ionicons name="map" size={15} color="#2E7D32" /> {t.mapPreviewTitle}
                    </Text>
                    <View style={styles.mapContainer}>
                      <MapView
                        style={styles.map}
                        provider={PROVIDER_GOOGLE}
                        region={{
                          latitude: selectedStorage.coordinates.latitude,
                          longitude: selectedStorage.coordinates.longitude,
                          latitudeDelta: 0.015,
                          longitudeDelta: 0.015,
                        }}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                      >
                        <Marker
                          coordinate={{
                            latitude: selectedStorage.coordinates.latitude,
                            longitude: selectedStorage.coordinates.longitude,
                          }}
                          title={selectedStorage.name}
                          description={selectedStorage.district}
                        >
                          <View style={styles.mapMarker}>
                            <MaterialCommunityIcons name="warehouse" size={20} color="#fff" />
                          </View>
                        </Marker>
                      </MapView>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL(`tel:${selectedStorage.ownerContact}`)}>
                  <Ionicons name="call" size={22} color="#fff" />
                  <Text style={styles.callBtnText}>{t.callOwner}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: '#1565C0', marginTop: 10 }]}
                  onPress={openGoogleMaps}
                >
                  <Ionicons name="navigate" size={22} color="#fff" />
                  <Text style={styles.callBtnText}>{t.getDirections}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.speakBtn, speaking && styles.speakBtnActive]} onPress={handleSpeak}>
                  <MaterialCommunityIcons name={speaking ? 'stop-circle-outline' : 'volume-high'} size={20} color="#fff" />
                  <Text style={styles.speakBtnText}>{speaking ? `⏹ ${t.stopBtn}` : `🔊 ${t.listenBtn}`}</Text>
                </TouchableOpacity>

                {!markedStored ? (
                  <View style={styles.foundStorageBox}>
                    <Text style={styles.foundStorageQuestion}>
                      {t.foundStorageQuestion}{'\n'}
                      <Text style={styles.foundStorageCropName}>{selectedHarvest?.cropName}?</Text>
                    </Text>
                    <View style={styles.foundStorageBtnRow}>
                      <TouchableOpacity
                        style={[styles.foundStorageBtn, styles.foundStorageYesBtn, markingStored && { opacity: 0.6 }]}
                        onPress={handleFoundStorage}
                        disabled={markingStored}
                      >
                        {markingStored
                          ? <ActivityIndicator color="#fff" size="small" />
                          : <Text style={styles.foundStorageBtnText}>✅ {t.foundStorageYes}</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.foundStorageBtn, styles.foundStorageNoBtn]}
                        onPress={goBack}
                      >
                        <Text style={[styles.foundStorageBtnText, { color: '#555' }]}>❌ {t.foundStorageNo}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.foundStorageSuccessBox}>
                    <Text style={styles.foundStorageSuccessText}>{t.foundStorageSuccess}</Text>
                  </View>
                )}

                <View style={{ height: 80 }} />
              </ScrollView>
            ) : null}
          </View>
        )}

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  stepContainer: { flex: 1, paddingTop: 70, paddingHorizontal: 20, paddingBottom: 20 },
  stepTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4 },
  stepSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginBottom: 20 },
  harvestCard: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 14, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 3 },
  harvestCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  harvestCropName: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  harvestMeta: { fontSize: 13, color: '#555', marginTop: 2 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  emptyText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, textAlign: 'center', marginTop: 16, lineHeight: 24 },
  primaryBtn: { backgroundColor: '#2E7D32', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 30, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  fullContainer: { flex: 1 },
  listHeader: { backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 20, paddingTop: 55, paddingBottom: 12 },
  listTitle: { fontSize: 20, fontWeight: 'bold', color: '#2E7D32' },
  listSub: { fontSize: 13, color: '#666', marginTop: 3 },
  listScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  loadingText: { marginTop: 12, color: '#fff', fontSize: 15 },
  errorText: { color: '#fff', textAlign: 'center', marginVertical: 15, fontSize: 15, lineHeight: 22 },
  storageCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, elevation: 3 },
  storageCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  storageName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', flex: 1, marginRight: 8 },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  distanceText: { fontSize: 12, color: '#2E7D32', fontWeight: '600', marginLeft: 2 },
  storageDistrict: { fontSize: 12, color: '#888', marginBottom: 6 },
  cropsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  storesLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  cropsText: { fontSize: 12, color: '#333', flex: 1 },
  storageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capacityText: { fontSize: 12, color: '#888' },
  floatingBack: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)', marginHorizontal: 16, marginBottom: 20, borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#2E7D32' },
  floatingBackText: { color: '#2E7D32', fontWeight: '600', fontSize: 15, marginLeft: 6 },
  detailScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },
  detailHeader: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginBottom: 12, alignItems: 'center' },
  detailName: { fontSize: 19, fontWeight: 'bold', color: '#1a1a1a', textAlign: 'center' },
  registeredText: { fontSize: 12, color: '#888', marginTop: 6, textAlign: 'center', fontStyle: 'italic' },
  distanceBadgeLarge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, marginTop: 8 },
  distanceBadgeLargeText: { fontSize: 14, color: '#2E7D32', fontWeight: 'bold', marginLeft: 4 },
  straightLineNote: { fontSize: 11, color: '#999', marginTop: 4, fontStyle: 'italic' },
  detailCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  detailRow: { flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
  detailValue: { fontSize: 15, color: '#222', fontWeight: '500' },
  callBtn: { backgroundColor: '#2E7D32', borderRadius: 14, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  callBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  speakBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(46,125,50,0.85)', borderRadius: 14, paddingVertical: 12, marginTop: 10 },
  speakBtnActive: { backgroundColor: 'rgba(183,28,28,0.85)' },
  speakBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  foundStorageBox: { marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 18, borderWidth: 2, borderColor: '#2E7D32', elevation: 4 },
  foundStorageQuestion: { fontSize: 15, color: '#333', textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  foundStorageCropName: { fontWeight: 'bold', color: '#2E7D32', fontSize: 16 },
  foundStorageBtnRow: { flexDirection: 'row', gap: 10 },
  foundStorageBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  foundStorageYesBtn: { backgroundColor: '#2E7D32' },
  foundStorageNoBtn: { backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ccc' },
  foundStorageBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  foundStorageSuccessBox: { marginTop: 16, backgroundColor: '#E8F5E9', borderRadius: 14, padding: 18, borderWidth: 1.5, borderColor: '#2E7D32', alignItems: 'center' },
  foundStorageSuccessText: { color: '#2E7D32', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  mapCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, elevation: 3 },
  mapCardTitle: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginBottom: 10 },
  mapContainer: { height: 220, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: '#E8F5E9' },
  map: { flex: 1 },
  mapMarker: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 4,
  },
});