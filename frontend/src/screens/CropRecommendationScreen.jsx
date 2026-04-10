import React, { useState, useContext, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ImageBackground,
    ActivityIndicator,
    Alert,
    StyleSheet,
    Dimensions,
    TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { AppContext } from '../context/AppContext';
import { apiRequest } from '../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = 'http://192.168.29.33:3000';

const CropRecommendationScreen = ({ navigation }) => {
    const {
        t,
        lang,
        setChatType,
        setChatVisible,
        setPinnedMessage,
        weatherData,
        location,
        setChatBackground,
        isChatVisible,
    } = useContext(AppContext);

    const [step, setStep] = useState(0);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [activeCrop, setActiveCrop] = useState(null);
    const [endingCrop, setEndingCrop] = useState(false);

    // ─── Harvest states ────────────────────────────────────────────────────
    const [showHarvestInput, setShowHarvestInput] = useState(false);
    const [harvestQuantity, setHarvestQuantity] = useState('');
    const [harvestUnit, setHarvestUnit] = useState('kg');
    const [recordingHarvest, setRecordingHarvest] = useState(false);
    const [harvestDone, setHarvestDone] = useState(false);

    // Speaker state
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        Speech.stop();
        setIsSpeaking(false);
        if (isMuted) return;
        const timer = setTimeout(() => {
            if (step === 1) speak(t.sownAlready);
        }, 500);
        return () => clearTimeout(timer);
    }, [step, isMuted]);

    const speak = (msg) => {
        if (isMuted) return;
        Speech.stop();
        setIsSpeaking(true);
        Speech.speak(msg, {
            rate: 1.0, pitch: 1.0, language: lang,
            onDone: () => setIsSpeaking(false),
            onError: () => setIsSpeaking(false),
        });
    };

    const toggleMute = () => {
        if (!isMuted) { Speech.stop(); setIsSpeaking(false); }
        setIsMuted(!isMuted);
    };

    useEffect(() => {
        return () => { Speech.stop(); setIsSpeaking(false); };
    }, []);

    useEffect(() => {
        if (step === 1) navigation.setOptions({ title: 'My Crop' });
        else navigation.setOptions({ title: 'Crop Recommendation' });
    }, [step]);

    // ✅ CHANGED — useFocusEffect re-fetches fresh data every time
    // farmer navigates to this screen, so daysPassed updates daily automatically
    useFocusEffect(
        React.useCallback(() => {
            const checkActiveCrop = async () => {
                setLoading(true);
                try {
                    const token = await AsyncStorage.getItem('token');
                    const res = await fetch(`${API_BASE_URL}/api/crops/active`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const data = await res.json();
                    if (data?.success && data?.data) {
                        setActiveCrop(data.data);
                        setStep(3);
                    } else {
                        setStep(1);
                    }
                } catch (err) {
                    setStep(1);
                } finally {
                    setLoading(false);
                }
            };
            checkActiveCrop();
        }, [])
    );

    useEffect(() => {
        if (isChatVisible) { Speech.stop(); setIsSpeaking(false); }
    }, [isChatVisible]);

    // ─── Harvest crop handler ──────────────────────────────────────────────
    const handleHarvestCrop = async () => {
        if (!harvestQuantity || isNaN(harvestQuantity) || parseFloat(harvestQuantity) <= 0) {
            Alert.alert(
                lang === 'hi' ? 'गलत मात्रा' : lang === 'bn' ? 'ভুল পরিমাণ' : 'Invalid Quantity',
                lang === 'hi' ? 'कृपया सही मात्रा दर्ज करें' : lang === 'bn' ? 'সঠিক পরিমাণ দিন' : 'Please enter a valid quantity'
            );
            return;
        }

        setRecordingHarvest(true);
        try {
            const token = await AsyncStorage.getItem('token');

            const availableRes = await fetch(`${API_BASE_URL}/api/harvest/available`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const availableData = await availableRes.json();

            if (!availableData.success || !availableData.crops?.length) {
                throw new Error('No harvestable crop found');
            }

            const farmerCropId = availableData.crops[0].farmerCropId;

            let quantityKg = parseFloat(harvestQuantity);
            if (harvestUnit === 'quintal') quantityKg *= 100;
            if (harvestUnit === 'ton') quantityKg *= 1000;

            const recordRes = await fetch(`${API_BASE_URL}/api/harvest/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ farmerCropId, quantity: quantityKg, notes: `${harvestQuantity} ${harvestUnit}` })
            });
            const recordData = await recordRes.json();

            if (!recordData.success) throw new Error(recordData.message || 'Failed to record harvest');

            setHarvestDone(true);
            setShowHarvestInput(false);

            Alert.alert(
                lang === 'hi' ? '✅ फसल दर्ज हो गई!' : lang === 'bn' ? '✅ ফসল নথিভুক্ত হয়েছে!' : '✅ Harvest Recorded!',
                lang === 'hi'
                    ? 'आपकी फसल सफलतापूर्वक दर्ज हो गई। अब कोल्ड स्टोरेज खोजने के लिए स्टोरेज सेक्शन में जाएं।'
                    : lang === 'bn'
                    ? 'আপনার ফসল সফলভাবে নথিভুক্ত হয়েছে। কোল্ড স্টোরেজ খুঁজতে স্টোরেজ বিভাগে যান।'
                    : 'Your harvest has been recorded. Go to the Storage section to find cold storage near you.',
                [{ text: lang === 'hi' ? 'ठीक है' : lang === 'bn' ? 'ঠিক আছে' : 'OK' }]
            );

        } catch (e) {
            Alert.alert('Error', e.message || 'Something went wrong');
        } finally {
            setRecordingHarvest(false);
        }
    };

    const fetchRecommendations = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiRequest('/api/crops/recommendation', 'GET');
            if (data?.mode === 'ACTIVE_CROP_EXISTS') {
                setChatType('CropAdv');
                navigation.navigate('CropAdv');
                return;
            }
            if (data?.data && Array.isArray(data.data)) {
                const mapped = data.data.map(crop => ({
                    id: crop.id,
                    name: crop.cropNameEn,
                    duration: `${crop.growingDurationDays} days`,
                    waterRequirement: crop.waterRequirement,
                    climate: crop.suitableClimate,
                }));
                setRecommendations(mapped);
                setStep(2);
            } else {
                throw new Error('Invalid data');
            }
        } catch (err) {
            setError('Unable to load recommendations');
            setStep(2);
            Alert.alert('Oops!', 'Something went wrong. Please try again.', [{ text: 'OK' }]);
        } finally {
            setLoading(false);
        }
    };

    const getCurrentSeason = () => {
        if (weatherData?.season) return weatherData.season;
        const month = new Date().getMonth();
        if (month >= 2 && month <= 5) return 'Summer';
        if (month >= 6 && month <= 9) return 'Monsoon';
        return 'Winter';
    };

    const handleSownAlready = (val) => {
        setSelectedOption(val);
        setChatBackground(require('../assets/truck.jpg'));
        if (val === 'yes') { setChatType('CropAdv'); navigation.navigate('CropAdv'); }
        else fetchRecommendations();
    };

    const handleCropSelect = async (crop) => {
        try {
            await apiRequest('/api/crops/select', 'POST', { cropId: crop.id });
        } catch (error) {
            console.log('Crop select note:', error.message);
        }
        const season = getCurrentSeason();
        const summary =
            `🌾 Crop: ${crop.name}\n` +
            `📅 Season: ${season}\n` +
            `⏱ Grows in: ${crop.duration || 'N/A'}\n` +
            `💧 Water Need: ${crop.waterRequirement || 'N/A'}\n` +
            `🌤 Climate: ${crop.climate || 'N/A'}`;
        setPinnedMessage(summary);
        setChatType('Recommendation');
        setChatBackground(require('../assets/truck.jpg'));
        setChatVisible(true);
    };

    const handleContinueWithActiveCrop = () => {
        if (!activeCrop) return;
        const summary =
            `🌾 Crop: ${activeCrop.cropName}\n` +
            `📅 Sown On: ${activeCrop.sowingDate ? new Date(activeCrop.sowingDate).toLocaleDateString() : 'N/A'}\n` +
            `⏱ Day ${activeCrop.daysPassed} of ${activeCrop.totalDuration}\n` +
            `💧 Water Need: ${activeCrop.waterRequirement || 'N/A'}`;
        setPinnedMessage(summary);
        if (location?.id) AsyncStorage.setItem(`pinnedMessage_${location.id}`, summary);
        setChatType('Advisory');
        setChatBackground(require('../assets/truck.jpg'));
        setChatVisible(true);
    };

    const handleEndCrop = () => {
        Alert.alert(
            t.startFreshTitle,
            t.startFreshMsg,
            [
                { text: t.noGoBack, style: 'cancel' },
                {
                    text: t.yesStartFresh, style: 'destructive',
                    onPress: async () => {
                        setEndingCrop(true);
                        try {
                            await apiRequest('/api/crops/end', 'PATCH');
                            setActiveCrop(null);
                            setHarvestDone(false);
                            setShowHarvestInput(false);
                            setHarvestQuantity('');
                            setStep(1);
                        } catch (err) {
                            Alert.alert('Error', 'Could not end crop. Please try again.');
                        } finally {
                            setEndingCrop(false);
                        }
                    }
                }
            ]
        );
    };

    const handleGoBack = () => {
        setStep(1);
        setRecommendations([]);
        setError(null);
        setSelectedOption(null);
        Speech.stop();
        setIsSpeaking(false);
    };

    const getBackgroundImage = () =>
        step === 1 ? require('../assets/homebg.jpg') : require('../assets/crop.jpg');

    const renderCropCard = (crop) => {
        const imageSource = crop.imageUrl ? { uri: crop.imageUrl } : require('../assets/crop.jpg');
        return (
            <TouchableOpacity key={crop.id || crop._id} style={styles.cropCard} onPress={() => handleCropSelect(crop)} activeOpacity={0.7}>
                <ImageBackground source={imageSource} style={styles.cropImage} imageStyle={{ borderRadius: 10 }}>
                    <View style={styles.cropOverlay}>
                        <Text style={styles.cropName}>{crop.name}</Text>
                        <View style={styles.cropDetails}>
                            {crop.confidence && <Text style={styles.cropInfo}>✓ {crop.confidence}</Text>}
                            {crop.duration && <Text style={styles.cropInfo}>⏱ {crop.duration}</Text>}
                            {crop.waterRequirement && <Text style={styles.cropInfo}>💧 {crop.waterRequirement}</Text>}
                        </View>
                    </View>
                </ImageBackground>
            </TouchableOpacity>
        );
    };

    const unitLabel = (u) => {
        if (lang === 'hi') return u === 'kg' ? 'किग्रा' : u === 'quintal' ? 'क्विंटल' : 'टन';
        if (lang === 'bn') return u === 'kg' ? 'কেজি' : u === 'quintal' ? 'কুইন্টাল' : 'টন';
        return u;
    };

    return (
        <ImageBackground source={getBackgroundImage()} style={styles.backgroundImage} resizeMode="cover">
            <View style={[styles.overlay, step > 1 && { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                <View style={styles.container}>

                    {step === 0 && (
                        <View style={styles.centerContainer}>
                            <ActivityIndicator size="large" color="#2E7D32" />
                        </View>
                    )}

                    {step === 3 && (() => {
                        const pct = activeCrop?.progressPercent || 0;

                        let stageEmoji = '', stageLabel = '', stageDesc = '';
                        if (pct <= 10)       { stageEmoji = '🌾'; stageLabel = 'Sowing Stage';              stageDesc = 'Seeds are newly sown. Ensure proper soil moisture and protection.'; }
                        else if (pct <= 25)  { stageEmoji = '🌱'; stageLabel = 'Early Growth Stage';        stageDesc = 'Crop has started growing. Monitor water and basic nutrients.'; }
                        else if (pct <= 40)  { stageEmoji = '🌿'; stageLabel = 'Vegetative Growth Stage';   stageDesc = 'Plants are developing leaves and height. Regular care is important.'; }
                        else if (pct <= 60)  { stageEmoji = '🌳'; stageLabel = 'Strong Growth Stage';       stageDesc = 'Crop is growing actively. Focus on fertilizer and pest monitoring.'; }
                        else if (pct <= 75)  { stageEmoji = '🌼'; stageLabel = 'Flowering Stage';           stageDesc = 'Crop is entering reproductive phase. Water and disease control are crucial.'; }
                        else if (pct <= 90)  { stageEmoji = '🌾'; stageLabel = 'Grain / Fruit Formation';  stageDesc = 'Yield is developing. Maintain nutrition and protect from weather risks.'; }
                        else if (pct < 100)  { stageEmoji = '🌞'; stageLabel = 'Maturity Stage';            stageDesc = 'Crop is almost ready. Prepare for harvesting activities.'; }
                        else                 { stageEmoji = '🚜'; stageLabel = 'Ready for Harvest';         stageDesc = 'Your crop is fully mature. You can begin harvesting.'; }

                        const isReadyToHarvest = pct >= 100;

                        return (
                            <View style={styles.centerContainer}>
                                <View style={styles.activeCropCard}>
                                    <Text style={styles.activeCropTitle}>🌾 Your Crop</Text>
                                    <View style={styles.activeCropRow}>
                                        <Text style={styles.activeCropLabel}>Crop:</Text>
                                        <Text style={styles.activeCropValue}>{activeCrop?.cropName}</Text>
                                    </View>
                                    <View style={styles.activeCropRow}>
                                        <Text style={styles.activeCropLabel}>Farm:</Text>
                                        <Text style={styles.activeCropValue}>{activeCrop?.location}</Text>
                                    </View>
                                    <View style={styles.activeCropRow}>
                                        <Text style={styles.activeCropLabel}>Progress:</Text>
                                        <Text style={styles.activeCropValue}>Day {activeCrop?.daysPassed} of {activeCrop?.totalDuration}</Text>
                                    </View>
                                    <View style={[styles.activeCropRow, { borderBottomWidth: 0, marginBottom: 14 }]}>
                                        <Text style={styles.activeCropLabel}>Days Left:</Text>
                                        <Text style={styles.activeCropValue}>{activeCrop?.daysLeft} days</Text>
                                    </View>

                                    <View style={styles.stagePill}>
                                        <Text style={styles.stagePillText}>{stageEmoji}  {stageLabel}</Text>
                                    </View>

                                    <View style={styles.progressLabelRow}>
                                        <Text style={styles.progressLabelText}>Progress</Text>
                                        <Text style={styles.progressLabelPct}>{pct}%</Text>
                                    </View>
                                    <View style={styles.progressBarBg}>
                                        <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                                    </View>
                                    <Text style={styles.stageDesc}>{stageDesc}</Text>

                                    {isReadyToHarvest && showHarvestInput && !harvestDone && (
                                        <View style={styles.harvestInputBox}>
                                            <Text style={styles.harvestInputTitle}>
                                                {lang === 'hi' ? 'कितनी फसल काटी?' : lang === 'bn' ? 'কত ফসল কেটেছেন?' : 'How much did you harvest?'}
                                            </Text>
                                            <View style={styles.harvestRow}>
                                                <TextInput
                                                    style={styles.harvestQtyInput}
                                                    keyboardType="numeric"
                                                    placeholder="0"
                                                    placeholderTextColor="#999"
                                                    value={harvestQuantity}
                                                    onChangeText={setHarvestQuantity}
                                                    autoFocus
                                                />
                                                <View style={styles.unitRow}>
                                                    {['kg', 'quintal', 'ton'].map(u => (
                                                        <TouchableOpacity
                                                            key={u}
                                                            style={[styles.unitChip, harvestUnit === u && styles.unitChipActive]}
                                                            onPress={() => setHarvestUnit(u)}
                                                        >
                                                            <Text style={[styles.unitChipText, harvestUnit === u && styles.unitChipTextActive]}>
                                                                {unitLabel(u)}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                            <View style={styles.harvestBtnRow}>
                                                <TouchableOpacity
                                                    style={styles.harvestCancelBtn}
                                                    onPress={() => { setShowHarvestInput(false); setHarvestQuantity(''); }}
                                                >
                                                    <Text style={styles.harvestCancelText}>
                                                        {lang === 'hi' ? 'रद्द करें' : lang === 'bn' ? 'বাতিল' : 'Cancel'}
                                                    </Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.harvestConfirmBtn, recordingHarvest && { opacity: 0.6 }]}
                                                    onPress={handleHarvestCrop}
                                                    disabled={recordingHarvest}
                                                >
                                                    {recordingHarvest
                                                        ? <ActivityIndicator color="#fff" size="small" />
                                                        : <Text style={styles.harvestConfirmText}>
                                                            {lang === 'hi' ? '✅ दर्ज करें' : lang === 'bn' ? '✅ নথিভুক্ত করুন' : '✅ Confirm'}
                                                        </Text>
                                                    }
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}

                                    {isReadyToHarvest && harvestDone && (
                                        <View style={styles.harvestDoneBox}>
                                            <Text style={styles.harvestDoneText}>
                                                {lang === 'hi' ? '✅ फसल दर्ज हो गई! अब कोल्ड स्टोरेज सेक्शन में जाएं।' :
                                                 lang === 'bn' ? '✅ ফসল নথিভুক্ত হয়েছে! এখন স্টোরেজ বিভাগে যান।' :
                                                 '✅ Harvest recorded! Go to Storage section to find cold storage.'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity style={styles.primaryBtn} onPress={handleContinueWithActiveCrop}>
                                    <Text style={styles.btnText}>{t.continueToChat}</Text>
                                </TouchableOpacity>

                                {isReadyToHarvest && !harvestDone && !showHarvestInput && (
                                    <TouchableOpacity
                                        style={[styles.primaryBtn, styles.harvestBtn]}
                                        onPress={() => setShowHarvestInput(true)}
                                    >
                                        <Text style={styles.btnText}>
                                            {lang === 'hi' ? '🌾 फसल काटें' : lang === 'bn' ? '🌾 ফসল কাটুন' : '🌾 Harvest Crop'}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.primaryBtn, styles.secondaryBtn]}
                                    onPress={handleEndCrop}
                                    disabled={endingCrop}
                                >
                                    {endingCrop
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text style={styles.btnText}>{t.startNewCrop}</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        );
                    })()}

                    {step === 1 && (
                        <View style={styles.centerContainer}>
                            <Ionicons name="help-circle-outline" size={90} color="#2E7D32" />
                            <Text style={styles.questionText}>{t.sownAlready}</Text>
                            <TouchableOpacity style={styles.primaryBtn} onPress={() => handleSownAlready('yes')}>
                                <Text style={styles.btnText}>{t.yes}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.primaryBtn, styles.secondaryBtn]} onPress={() => handleSownAlready('no')}>
                                <Text style={styles.btnText}>{t.no}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {step === 2 && (
                        <View style={styles.container}>
                            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                                <View style={styles.headerContainer}>
                                    <Text style={styles.sectionTitle}>Recommended Crops for {getCurrentSeason()} Season</Text>
                                    <Text style={styles.subtitle}>Based on your location and weather</Text>
                                </View>
                                {loading ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#2E7D32" />
                                        <Text style={styles.loadingText}>Finding best crops for you...</Text>
                                    </View>
                                ) : error ? (
                                    <View style={styles.errorContainer}>
                                        <Ionicons name="cloud-offline-outline" size={60} color="#666" />
                                        <Text style={styles.errorText}>Unable to load recommendations</Text>
                                        <TouchableOpacity style={styles.retryBtn} onPress={fetchRecommendations}>
                                            <Text style={styles.retryBtnText}>Try Again</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
                                            <Text style={styles.backBtnText}>Go Back</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : recommendations.length > 0 ? (
                                    <View style={styles.recommendationsContainer}>
                                        {recommendations.map(renderCropCard)}
                                    </View>
                                ) : (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="leaf-outline" size={60} color="#666" />
                                        <Text style={styles.emptyText}>No crops found</Text>
                                        <TouchableOpacity style={styles.retryBtn} onPress={fetchRecommendations}>
                                            <Text style={styles.retryBtnText}>Refresh</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.backBtn} onPress={handleGoBack}>
                                            <Text style={styles.backBtnText}>Go Back</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View style={styles.bottomPadding} />
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.speakerFixedContainer}>
                        <TouchableOpacity
                            style={[styles.speakerButton, isMuted ? styles.mutedButton : styles.activeButton]}
                            onPress={toggleMute}
                        >
                            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#fff" />
                        </TouchableOpacity>
                        {isSpeaking && !isMuted && (
                            <View style={styles.waveContainer}>
                                <View style={styles.wave1} />
                                <View style={styles.wave2} />
                                <View style={styles.wave3} />
                            </View>
                        )}
                    </View>

                    {step > 1 && !loading && !error && recommendations.length > 0 && (
                        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                            <Ionicons name="arrow-back-circle" size={50} color="#2E7D32" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { flex: 1, padding: 16 },
    headerContainer: { marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.8)', padding: 15, borderRadius: 10 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, paddingBottom: 100 },
    backgroundImage: { flex: 1, width: '100%', height: '100%' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    questionText: { marginTop: 15, fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 30, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
    primaryBtn: { backgroundColor: '#2E7D32', paddingVertical: 15, paddingHorizontal: 50, borderRadius: 30, marginVertical: 8, width: '80%', elevation: 3 },
    secondaryBtn: { backgroundColor: '#FF8F00' },
    harvestBtn: { backgroundColor: '#1565C0' },
    btnText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
    sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 10 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10 },
    loadingText: { marginTop: 15, fontSize: 16, color: '#2E7D32', textAlign: 'center', fontWeight: '500' },
    errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10 },
    errorText: { fontSize: 18, color: '#333', textAlign: 'center', marginTop: 15, fontWeight: '600' },
    retryBtn: { backgroundColor: '#2E7D32', paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25, marginBottom: 10, width: 200 },
    retryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    backBtn: { paddingHorizontal: 40, paddingVertical: 12, borderRadius: 25, width: 200 },
    backBtnText: { color: '#666', fontSize: 16, fontWeight: '500', textAlign: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 10 },
    emptyText: { fontSize: 18, color: '#333', marginTop: 15, fontWeight: '600', textAlign: 'center' },
    emptySubText: { fontSize: 14, color: '#666', marginBottom: 25, marginTop: 5, textAlign: 'center' },
    recommendationsContainer: { paddingBottom: 20 },
    cropCard: { marginBottom: 16, borderRadius: 12, overflow: 'hidden', elevation: 4 },
    cropImage: { width: '100%', height: 200 },
    cropOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 16, justifyContent: 'flex-end' },
    cropName: { fontSize: 26, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    cropDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cropInfo: { fontSize: 12, color: '#fff', backgroundColor: 'rgba(46,125,50,0.85)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, marginRight: 8, marginBottom: 8, overflow: 'hidden', fontWeight: '500' },
    backButton: { position: 'absolute', bottom: 20, left: 100, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 25, elevation: 5, padding: 2, zIndex: 999 },
    bottomPadding: { height: 60 },
    activeCropCard: { backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 16, padding: 20, width: '90%', marginBottom: 24, elevation: 5, borderWidth: 1.5, borderColor: '#2E7D32' },
    activeCropTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', textAlign: 'center', marginBottom: 14 },
    activeCropRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
    activeCropLabel: { fontSize: 14, fontWeight: '600', color: '#555', width: 80 },
    activeCropValue: { fontSize: 14, color: '#222', flex: 1, textAlign: 'right' },
    stagePill: { backgroundColor: '#E8F5E9', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#A5D6A7', marginBottom: 12 },
    stagePillText: { fontSize: 13, fontWeight: '600', color: '#2E7D32' },
    progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    progressLabelText: { fontSize: 12, color: '#888' },
    progressLabelPct: { fontSize: 12, fontWeight: '600', color: '#2E7D32' },
    progressBarBg: { backgroundColor: '#e0e0e0', borderRadius: 10, height: 12, marginBottom: 10, overflow: 'hidden' },
    progressBarFill: { backgroundColor: '#2E7D32', height: 12, borderRadius: 10 },
    stageDesc: { fontSize: 13, color: '#555', fontStyle: 'italic', lineHeight: 20, marginTop: 2 },
    harvestInputBox: { marginTop: 16, backgroundColor: '#E3F2FD', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1565C0' },
    harvestInputTitle: { fontSize: 14, fontWeight: '600', color: '#1565C0', marginBottom: 10, textAlign: 'center' },
    harvestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    harvestQtyInput: { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#90CAF9', padding: 10, fontSize: 18, fontWeight: 'bold', color: '#222', textAlign: 'center' },
    unitRow: { flexDirection: 'row', gap: 6 },
    unitChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: '#90CAF9' },
    unitChipActive: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
    unitChipText: { fontSize: 12, color: '#1565C0', fontWeight: '600' },
    unitChipTextActive: { color: '#fff' },
    harvestBtnRow: { flexDirection: 'row', gap: 10 },
    harvestCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#999', alignItems: 'center', backgroundColor: '#fff' },
    harvestCancelText: { color: '#666', fontWeight: '600' },
    harvestConfirmBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1565C0', alignItems: 'center' },
    harvestConfirmText: { color: '#fff', fontWeight: '700' },
    harvestDoneBox: { marginTop: 12, backgroundColor: '#E8F5E9', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2E7D32' },
    harvestDoneText: { color: '#2E7D32', fontSize: 13, fontWeight: '600', textAlign: 'center' },
    speakerFixedContainer: { position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', alignItems: 'center', zIndex: 1000, elevation: 10 },
    speakerButton: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
    activeButton: { backgroundColor: '#2E7D32' },
    mutedButton: { backgroundColor: '#D32F2F' },
    waveContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    wave1: { width: 4, height: 12, backgroundColor: '#2E7D32', marginHorizontal: 2, borderRadius: 2, opacity: 0.7 },
    wave2: { width: 4, height: 20, backgroundColor: '#2E7D32', marginHorizontal: 2, borderRadius: 2, opacity: 1 },
    wave3: { width: 4, height: 12, backgroundColor: '#2E7D32', marginHorizontal: 2, borderRadius: 2, opacity: 0.7 },
});

export default CropRecommendationScreen;