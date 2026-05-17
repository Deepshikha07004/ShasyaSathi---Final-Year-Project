import React, { useState, useEffect, useContext } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ImageBackground,
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    ScrollView,
    Modal,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { AppContext } from '../context/AppContext';
import { apiRequest } from '../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width, height } = Dimensions.get('window');

// ─── Crop list from ML knowledge base ────────────────────────────────────────
// These are all the crops the ML model is trained on.
// Sorted alphabetically. "Other" is always last.
const CROP_LIST = [
    { en: 'Banana',       hi: 'केला',       bn: 'কলা'         },
    { en: 'Black Gram',   hi: 'उड़द',        bn: 'কালো ডাল'   },
    { en: 'Chickpea',     hi: 'चना',        bn: 'ছোলা'        },
    { en: 'Coconut',      hi: 'नारियल',     bn: 'নারকেল'      },
    { en: 'Coffee',       hi: 'कॉफी',       bn: 'কফি'         },
    { en: 'Cotton',       hi: 'कपास',       bn: 'তুলা'        },
    { en: 'Grapes',       hi: 'अंगूर',      bn: 'আঙুর'        },
    { en: 'Groundnut',    hi: 'मूंगफली',    bn: 'বাদাম'       },
    { en: 'Jute',         hi: 'जूट',        bn: 'পাট'         },
    { en: 'Kidney Beans', hi: 'राजमा',      bn: 'কিডনি বিনস' },
    { en: 'Lentil',       hi: 'मसूर',       bn: 'মসুর ডাল'   },
    { en: 'Maize',        hi: 'मक्का',      bn: 'ভুট্টা'      },
    { en: 'Mango',        hi: 'आम',         bn: 'আম'          },
    { en: 'Moth Beans',   hi: 'मोठ',        bn: 'মোঠ বিনস'   },
    { en: 'Mung Bean',    hi: 'मूंग',       bn: 'মুগ ডাল'    },
    { en: 'Muskmelon',    hi: 'खरबूजा',     bn: 'খরমুজ'       },
    { en: 'Onion',        hi: 'प्याज',      bn: 'পেঁয়াজ'     },
    { en: 'Orange',       hi: 'संतरा',      bn: 'কমলা'        },
    { en: 'Papaya',       hi: 'पपीता',      bn: 'পেঁপে'       },
    { en: 'Pigeon Peas',  hi: 'अरहर',       bn: 'অড়হর'        },
    { en: 'Pomegranate',  hi: 'अनार',       bn: 'ডালিম'       },
    { en: 'Potato',       hi: 'आलू',        bn: 'আলু'         },
    { en: 'Rice',         hi: 'चावल',       bn: 'ধান'         },
    { en: 'Soybean',      hi: 'सोयाबीन',    bn: 'সয়াবিন'     },
    { en: 'Sugarcane',    hi: 'गन्ना',       bn: 'আখ'          },
    { en: 'Tomato',       hi: 'टमाटर',      bn: 'টমেটো'       },
    { en: 'Watermelon',   hi: 'तरबूज',      bn: 'তরমুজ'       },
    { en: 'Wheat',        hi: 'गेहूं',       bn: 'গম'          },
];

const CropAdvisoryScreen = () => {
    const { t, lang, location, setChatType, setChatVisible, setPinnedMessage, setChatBackground, isChatVisible } = useContext(AppContext);
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({ name: '', date: '', fertilizer: '', pest: '', soil: '' });
    const [chatOpened, setChatOpened] = useState(false);
    const [showManualButton, setShowManualButton] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // ─── Dropdown state ───────────────────────────────────────────────────────
    const [showDropdown, setShowDropdown] = useState(false);
    const [showOtherInput, setShowOtherInput] = useState(false);
    const [otherCropName, setOtherCropName] = useState('');

    // Speaker state
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useFocusEffect(
        React.useCallback(() => {
            console.log('Screen focused');
            return () => {
                console.log('Screen unfocused - stopping speech');
                Speech.stop();
                setIsSpeaking(false);
            };
        }, [])
    );

    const speak = (msg) => {
        if (isMuted) return;
        Speech.stop();
        setIsSpeaking(true);
        Speech.speak(msg, {
            rate: 1.0,
            pitch: 1.0,
            language: lang,
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
        Speech.stop();
        setIsSpeaking(false);
        if (isMuted) return;
        if (step === 0) speak(t.advIntro);
        else if (step === 1) speak(t.advQ1);
        else if (step === 2) speak(t.advQ2);
        else if (step === 3) speak(t.advQ3);
        else if (step === 4) speak(t.advQ4);
        else if (step === 5) {
            speak(t.advSummary);
            if (!chatOpened) {
                setTimeout(() => { openChatbotWithDetails(); }, 500);
            }
        }
    }, [step, isMuted]);

    useEffect(() => {
        if (isChatVisible) { Speech.stop(); setIsSpeaking(false); }
    }, [isChatVisible]);

    useEffect(() => {
        if (step === 5) {
            if (!isChatVisible && chatOpened) setShowManualButton(true);
            else setShowManualButton(false);
        }
    }, [isChatVisible, step, chatOpened]);

    const openChatbotWithDetails = () => {
        const displayDate = form.date
            ? new Date(form.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : 'Not specified';

        const summary =
            `🌾 Crop: ${form.name || 'Not specified'}\n` +
            `📅 Sown On: ${displayDate}\n` +
            `🧪 Fertilizer: ${form.fertilizer || 'Not specified'}\n` +
            `🐛 Issues: ${form.pest || 'Not specified'}`;

        setPinnedMessage(summary);
        if (location?.id) AsyncStorage.setItem(`pinnedMessage_${location.id}`, summary);
        setChatType('Advisory');
        setChatBackground(require('../assets/truck.jpg'));
        setChatVisible(true);
        setChatOpened(true);
        setShowManualButton(false);

        const saveCropInBackground = async () => {
            try {
                await apiRequest('/api/crops/save-advisory', 'POST', {
                    cropName: form.name || 'Unknown',
                    sowingDate: form.date || null,
                });
            } catch (error) {
                console.log('Advisory crop save note:', error.message);
            }
        };
        saveCropInBackground();
    };

    const handleContinue = (nextStep) => setStep(nextStep);
    const handleBack = () => { if (step > 0) setStep(prev => prev - 1); };

    // ─── Get display name based on language ──────────────────────────────────
    const getCropDisplayName = (crop) => {
        if (lang === 'hi') return `${crop.hi} (${crop.en})`;
        if (lang === 'bn') return `${crop.bn} (${crop.en})`;
        return crop.en;
    };

    const renderStep = () => {
        switch (step) {
            case 0:
                return (
                    <View style={styles.stepContainer}>
                        <View style={styles.iconContainer}>
                            <MaterialCommunityIcons name="frequently-asked-questions" size={80} color="#2E7D32" />
                        </View>
                        <Text style={styles.stepText}>{t.advIntro}</Text>
                        <TouchableOpacity
                            style={styles.continueButton}
                            onPress={() => handleContinue(1)}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.continueButtonText}>{t.continue}</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 1:
                return (
                    <View style={styles.stepContainer}>
                        <View style={styles.formContainer}>
                            <Text style={styles.questionText}>{t.advQ1}</Text>

                            {/* ✅ Dropdown selector button */}
                            <TouchableOpacity
                                style={styles.dropdownButton}
                                onPress={() => {
                                    setShowOtherInput(false);
                                    setShowDropdown(true);
                                }}
                                activeOpacity={0.8}
                            >
                                <Text style={[
                                    styles.dropdownButtonText,
                                    !form.name && { color: '#999' }
                                ]}>
                                    {form.name || (
                                        lang === 'hi' ? 'फसल चुनें...' :
                                        lang === 'bn' ? 'ফসল বেছে নিন...' :
                                        'Select a crop...'
                                    )}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color="#2E7D32" />
                            </TouchableOpacity>

                            {/* ✅ "Other" text input — shown when farmer picks Other */}
                            {showOtherInput && (
                                <View style={styles.otherInputContainer}>
                                    <Text style={styles.otherInputLabel}>
                                        {lang === 'hi' ? 'फसल का नाम लिखें:' :
                                         lang === 'bn' ? 'ফসলের নাম লিখুন:' :
                                         'Write your crop name:'}
                                    </Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={
                                            lang === 'hi' ? 'फसल का नाम...' :
                                            lang === 'bn' ? 'ফসলের নাম...' :
                                            'e.g. Mustard'
                                        }
                                        placeholderTextColor="#999"
                                        value={otherCropName}
                                        onChangeText={v => {
                                            setOtherCropName(v);
                                            setForm({ ...form, name: v });
                                        }}
                                        autoFocus
                                    />
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.continueButton, !form.name && styles.continueButtonDisabled]}
                                onPress={() => { if (form.name) handleContinue(2); }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.continueButtonText}>Next</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ✅ Crop dropdown modal */}
                        <Modal
                            visible={showDropdown}
                            transparent
                            animationType="slide"
                            onRequestClose={() => setShowDropdown(false)}
                        >
                            <TouchableOpacity
                                style={styles.modalOverlay}
                                activeOpacity={1}
                                onPress={() => setShowDropdown(false)}
                            >
                                <View style={styles.dropdownModal}>
                                    <View style={styles.dropdownHeader}>
                                        <Text style={styles.dropdownHeaderText}>
                                            {lang === 'hi' ? 'फसल चुनें' :
                                             lang === 'bn' ? 'ফসল বেছে নিন' :
                                             'Select your crop'}
                                        </Text>
                                        <TouchableOpacity onPress={() => setShowDropdown(false)}>
                                            <Ionicons name="close" size={24} color="#333" />
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView
                                        style={styles.dropdownList}
                                        showsVerticalScrollIndicator={true}
                                        bounces={false}
                                    >
                                        {CROP_LIST.map((crop, index) => (
                                            <TouchableOpacity
                                                key={crop.en}
                                                style={[
                                                    styles.dropdownItem,
                                                    form.name === crop.en && styles.dropdownItemSelected,
                                                    index === CROP_LIST.length - 1 && { borderBottomWidth: 0 }
                                                ]}
                                                onPress={() => {
                                                    setForm({ ...form, name: crop.en });
                                                    setShowOtherInput(false);
                                                    setOtherCropName('');
                                                    setShowDropdown(false);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[
                                                    styles.dropdownItemText,
                                                    form.name === crop.en && styles.dropdownItemTextSelected
                                                ]}>
                                                    {getCropDisplayName(crop)}
                                                </Text>
                                                {form.name === crop.en && (
                                                    <Ionicons name="checkmark" size={20} color="#2E7D32" />
                                                )}
                                            </TouchableOpacity>
                                        ))}

                                        {/* ✅ Other option — always last */}
                                        <TouchableOpacity
                                            style={[
                                                styles.dropdownItem,
                                                styles.dropdownItemOther,
                                                { borderBottomWidth: 0 }
                                            ]}
                                            onPress={() => {
                                                setShowOtherInput(true);
                                                setForm({ ...form, name: otherCropName });
                                                setShowDropdown(false);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="add-circle-outline" size={20} color="#FF8F00" style={{ marginRight: 10 }} />
                                            <Text style={styles.dropdownItemOtherText}>
                                                {lang === 'hi' ? 'अन्य फसल (खुद लिखें)' :
                                                 lang === 'bn' ? 'অন্য ফসল (নিজে লিখুন)' :
                                                 'Other (type your crop name)'}
                                            </Text>
                                        </TouchableOpacity>
                                    </ScrollView>
                                </View>
                            </TouchableOpacity>
                        </Modal>
                    </View>
                );

            case 2:
                return (
                    <View style={styles.stepContainer}>
                        <View style={styles.formContainer}>
                            <Text style={styles.questionText}>{t.advQ2}</Text>

                            <TouchableOpacity
                                style={styles.datePickerButton}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="calendar" size={22} color="#2E7D32" style={{ marginRight: 10 }} />
                                <Text style={styles.datePickerText}>
                                    {form.date
                                        ? new Date(form.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : 'Tap to select sowing date'}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={selectedDate}
                                    mode="date"
                                    display="calendar"
                                    maximumDate={new Date()}
                                    onChange={(event, date) => {
                                        setShowDatePicker(false);
                                        if (event.type !== 'dismissed' && date) {
                                            setSelectedDate(date);
                                            setForm({ ...form, date: date.toISOString() });
                                        }
                                    }}
                                />
                            )}

                            <View style={styles.navButtonRow}>
                                <TouchableOpacity
                                    style={styles.previousButton}
                                    onPress={() => handleBack()}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.previousButtonText}>Previous</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.continueButton, styles.navNextButton, !form.date && styles.continueButtonDisabled]}
                                    onPress={() => {
                                        if (!form.date) {
                                            const today = new Date();
                                            setSelectedDate(today);
                                            setForm({ ...form, date: today.toISOString() });
                                        }
                                        handleContinue(3);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.continueButtonText}>Next</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );

            case 3:
                return (
                    <View style={styles.stepContainer}>
                        <View style={styles.formContainer}>
                            <Text style={styles.questionText}>{t.advQ3}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Urea"
                                placeholderTextColor="#999"
                                value={form.fertilizer}
                                onChangeText={v => setForm({ ...form, fertilizer: v })}
                                autoFocus={true}
                            />
                            <View style={styles.navButtonRow}>
                                <TouchableOpacity
                                    style={styles.previousButton}
                                    onPress={() => handleBack()}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.previousButtonText}>Previous</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.continueButton, styles.navNextButton]}
                                    onPress={() => handleContinue(4)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.continueButtonText}>Next</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );

            case 4:
                return (
                    <View style={styles.stepContainer}>
                        <View style={styles.formContainer}>
                            <Text style={styles.questionText}>{t.advQ4}</Text>
                            <TextInput
                                style={[styles.input, styles.multilineInput]}
                                multiline
                                placeholder="Describe issues..."
                                placeholderTextColor="#999"
                                value={form.pest}
                                onChangeText={v => setForm({ ...form, pest: v })}
                                autoFocus={true}
                            />
                            <View style={styles.navButtonRow}>
                                <TouchableOpacity
                                    style={styles.previousButton}
                                    onPress={() => handleBack()}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.previousButtonText}>Previous</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.continueButton, styles.navNextButton]}
                                    onPress={() => handleContinue(5)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.continueButtonText}>Next</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                );

            case 5:
                return (
                    <View style={styles.stepContainer}>
                        <View style={styles.formContainer}>
                            <View style={styles.detailsContainer}>
                                <Text style={styles.detailsTitle}>✅ Crop Details</Text>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>🌾 Crop:</Text>
                                    <Text style={styles.detailValue}>{form.name || 'Not specified'}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>📅 Sowing:</Text>
                                    <Text style={styles.detailValue}>
                                        {form.date
                                            ? new Date(form.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                            : 'Not specified'}
                                    </Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>🧪 Fertilizer:</Text>
                                    <Text style={styles.detailValue}>{form.fertilizer || 'Not specified'}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>🐛 Issues:</Text>
                                    <Text style={styles.detailValue}>{form.pest || 'Not specified'}</Text>
                                </View>
                            </View>

                            {!chatOpened ? (
                                <>
                                    <Text style={styles.loadingText}>Opening chatbot with your crop details...</Text>
                                    <ActivityIndicator size="large" color="#2E7D32" style={styles.loader} />
                                </>
                            ) : showManualButton ? (
                                <TouchableOpacity
                                    style={styles.openChatButton}
                                    onPress={openChatbotWithDetails}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="chatbubbles" size={24} color="#fff" />
                                    <Text style={styles.openChatButtonText}>Open Chatbot</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>
                );

            default:
                return null;
        }
    };

    return (
        <ImageBackground
            source={require('../assets/truck.jpg')}
            style={styles.backgroundImage}
            resizeMode="cover"
        >
            <View style={[
                styles.overlay,
                { backgroundColor: step > 0 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.6)' }
            ]}>
                {renderStep()}

                <View style={styles.speakerFixedContainer}>
                    <TouchableOpacity
                        style={[styles.speakerButton, isMuted ? styles.mutedButton : styles.activeButton]}
                        onPress={toggleMute}
                        activeOpacity={0.7}
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
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    backgroundImage: { flex: 1, width: '100%', height: '100%' },
    overlay: { flex: 1, width: '100%', height: '100%' },
    stepContainer: { flex: 1, justifyContent: 'center', padding: 20, paddingBottom: 100 },
    iconContainer: { marginBottom: 20, borderRadius: 50, padding: 10, alignSelf: 'center' },
    stepText: { fontSize: 20, fontWeight: '600', color: '#fff', textAlign: 'center', marginBottom: 20, textShadowColor: 'rgba(0, 0, 0, 0.3)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
    formContainer: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 15, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    questionText: { fontSize: 20, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 15, fontSize: 16, marginBottom: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    multilineInput: { height: 100, textAlignVertical: 'top' },
    continueButton: { backgroundColor: '#2E7D32', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    continueButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
    continueButtonDisabled: { backgroundColor: '#a5d6a7' },
    navButtonRow: { flexDirection: 'row', gap: 10 },
    previousButton: { flex: 1, paddingVertical: 15, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#2E7D32', backgroundColor: '#fff' },
    previousButtonText: { color: '#2E7D32', fontSize: 18, fontWeight: '600', textAlign: 'center' },
    navNextButton: { flex: 1, paddingHorizontal: 0 },

    // ─── Dropdown styles ──────────────────────────────────────────────────────
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#2E7D32',
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        elevation: 2,
    },
    dropdownButtonText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dropdownModal: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: height * 0.65,
        paddingBottom: 20,
    },
    dropdownHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    dropdownHeaderText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1B5E20',
    },
    dropdownList: {
        paddingHorizontal: 10,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    dropdownItemSelected: {
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
    },
    dropdownItemText: {
        fontSize: 16,
        color: '#333',
        flex: 1,
    },
    dropdownItemTextSelected: {
        color: '#2E7D32',
        fontWeight: '600',
    },
    dropdownItemOther: {
        marginTop: 4,
        backgroundColor: '#FFF8E1',
        borderRadius: 8,
        borderBottomWidth: 0,
    },
    dropdownItemOtherText: {
        fontSize: 16,
        color: '#FF8F00',
        fontWeight: '600',
        flex: 1,
    },

    // ─── Other crop input ─────────────────────────────────────────────────────
    otherInputContainer: {
        marginBottom: 10,
    },
    otherInputLabel: {
        fontSize: 14,
        color: '#555',
        marginBottom: 6,
        fontWeight: '500',
    },

    // ─── Date picker ──────────────────────────────────────────────────────────
    datePickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f8f0', borderWidth: 1.5, borderColor: '#2E7D32', borderRadius: 10, padding: 15, marginBottom: 20 },
    datePickerText: { fontSize: 16, color: '#333', flex: 1 },

    // ─── Summary ──────────────────────────────────────────────────────────────
    detailsContainer: { backgroundColor: '#f0f8f0', borderRadius: 10, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#2E7D32' },
    detailsTitle: { fontSize: 18, fontWeight: 'bold', color: '#2E7D32', marginBottom: 15, textAlign: 'center' },
    detailRow: { flexDirection: 'row', marginBottom: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
    detailLabel: { fontSize: 14, fontWeight: '600', color: '#555', width: 80 },
    detailValue: { fontSize: 14, color: '#333', flex: 1 },
    loadingText: { fontSize: 16, color: '#666', textAlign: 'center', marginVertical: 15 },
    loader: { marginVertical: 10 },
    openChatButton: { backgroundColor: '#FF8F00', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, marginTop: 10 },
    openChatButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', marginLeft: 10 },

    // ─── Speaker ─────────────────────────────────────────────────────────────
    speakerFixedContainer: { position: 'absolute', bottom: 20, left: 20, flexDirection: 'row', alignItems: 'center', zIndex: 1000, elevation: 10 },
    speakerButton: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
    activeButton: { backgroundColor: '#2E7D32' },
    mutedButton: { backgroundColor: '#D32F2F' },
    waveContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
    wave1: { width: 4, height: 12, backgroundColor: '#2E7D32', marginHorizontal: 2, borderRadius: 2, opacity: 0.7 },
    wave2: { width: 4, height: 20, backgroundColor: '#2E7D32', marginHorizontal: 2, borderRadius: 2, opacity: 1 },
    wave3: { width: 4, height: 12, backgroundColor: '#2E7D32', marginHorizontal: 2, borderRadius: 2, opacity: 0.7 },
});

export default CropAdvisoryScreen;