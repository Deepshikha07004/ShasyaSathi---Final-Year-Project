import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    ActivityIndicator,
    Modal,
    ImageBackground,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Alert,
    Dimensions,
    Animated,
    TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { AppContext } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from '../api/apiClient';
import ChatMessage from './ChatMessage';
import { useNavigation } from '@react-navigation/native';
import { useGroq } from '../hooks/useGroq';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.78;

// expo-speech locale codes
const SPEECH_LANG_MAP = {
    en: 'en-IN',
    hi: 'hi-IN',
    bn: 'bn-IN',
};

const FloatingChatbot = () => {
    const navigation = useNavigation();
    const {
        lang,
        t,
        isChatVisible,
        setChatVisible,
        chatType,
        pinnedMessage,
        setPinnedMessage,
        chatBackground,
        location,
        weatherData,
        user
    } = useContext(AppContext);

    const { ask } = useGroq();

    // ── Language-aware welcome message ────────────────────────────────
    const getWelcomeMessage = () => {
        if (lang === 'hi') return "👋 नमस्ते! मैं शस्य साथी हूँ, आपका AI खेती सहायक। आज मैं आपकी कैसे मदद कर सकता हूँ?";
        if (lang === 'bn') return "👋 নমস্কার! আমি শস্য সাথী, আপনার AI কৃষি সহায়ক। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?";
        return "👋 Hi! I'm ShasyaSathi, your AI Farming Assistant. How can I help you today?";
    };

    // ── Language-aware crop welcome message ───────────────────────────
    const getCropWelcomeMessage = (cropName) => {
        if (lang === 'hi') return `आपके ${cropName} की जानकारी सुरक्षित है। पानी, खाद, कीट: कुछ भी पूछें!`;
        if (lang === 'bn') return `আপনার ${cropName} এর বিবরণ সংরক্ষিত হয়েছে। জল, সার, কীটপতঙ্গ: যেকোনো প্রশ্ন করুন!`;
        return `Your ${cropName} details are saved. Ask me anything: watering, fertilizer, pest control!`;
    };

    // ── Core chat state ──────────────────────────────────────────────
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    // effectiveChatType: CROP if pinned message exists, GENERAL otherwise
    const effectiveChatType = pinnedMessage ? 'CROP' : 'GENERAL';

    // FIX (previous session issue): tracks whether this is a fresh unsaved chat
    const pendingNewSession = useRef(false);

    // ── FIX: track whether the welcome message has been saved to DB ───
    const welcomeMessageSaved = useRef(false);

    // ── TTS state ────────────────────────────────────────────────────
    const [speakingId, setSpeakingId] = useState(null);

    // ── Drawer state ─────────────────────────────────────────────────
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const [cropSessions, setCropSessions] = useState([]);
    const [generalSessions, setGeneralSessions] = useState([]);
    const [cropDropdownOpen, setCropDropdownOpen] = useState(false);
    const [generalDropdownOpen, setGeneralDropdownOpen] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);

    // ── Voice recording state ────────────────────────────────────────
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [permissionResponse] = Audio.usePermissions();
    const [isTranscribing, setIsTranscribing] = useState(false);
    const waveAnim = useRef(new Animated.Value(1)).current;
    const recordingTimer = useRef(null);
    const scrollViewRef = useRef(null);

    // ── Stop speech when modal closes or unmounts ─────────────────────
    useEffect(() => {
        if (!isChatVisible) {
            Speech.stop();
            setSpeakingId(null);

            if (recording) {
                recording.stopAndUnloadAsync().catch(() => {});
                setRecording(null);
                setIsRecording(false);
                setRecordingDuration(0);
            }
            if (isTranscribing) {
                setIsTranscribing(false);
            }
        }
    }, [isChatVisible]);

    useEffect(() => {
        return () => { Speech.stop(); };
    }, []);

    // ── TTS: speak a bot message ──────────────────────────────────────
    const handleSpeak = (message) => {
        if (speakingId === message.id) {
            Speech.stop();
            setSpeakingId(null);
            return;
        }
        Speech.stop();

        const cleanText = message.text
            .replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{27FF}|\u{2300}-\u{23FF}|\u{FE00}-\u{FEFF}|\u{1F900}-\u{1F9FF}]/gu, '')
            .trim();

        const hasBengali = /[\u0980-\u09FF]/.test(message.text);
        const hasHindi   = /[\u0900-\u097F]/.test(message.text);
        let speechLang = 'en-IN';
        if (hasBengali) speechLang = 'bn-IN';
        else if (hasHindi) speechLang = 'hi-IN';

        let spokenText = cleanText;
        if (hasBengali) {
            spokenText = spokenText
                .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 থেকে $2')
                .replace(/\s*[-–—]\s*/g, ' থেকে ');
        } else if (hasHindi) {
            spokenText = spokenText
                .replace(/(\d)\s*[-–—]\s*(\d)/g, '$1 से $2')
                .replace(/\s*[-–—]\s*/g, ' से ');
        }

        setSpeakingId(message.id);
        Speech.speak(spokenText, {
            language: speechLang,
            rate: 0.9,
            pitch: 1.0,
            onDone:    () => setSpeakingId(null),
            onError:   () => setSpeakingId(null),
            onStopped: () => setSpeakingId(null),
        });
    };

    // ── Drawer ────────────────────────────────────────────────────────
    const openDrawer = () => {
        setDrawerOpen(true);
        loadSessions();
        Animated.timing(drawerAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start();
    };

    const closeDrawer = () => {
        Animated.timing(drawerAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true })
            .start(() => setDrawerOpen(false));
    };

    const loadSessions = async () => {
        if (!location?.id) return;
        setIsLoadingSessions(true);
        try {
            const data = await apiRequest(`/api/chat/sessions?locationId=${location.id}`, 'GET');
            if (data?.success) {
                setCropSessions(data.data.cropSessions || []);
                setGeneralSessions(data.data.generalSessions || []);
            }
        } catch (e) {
            console.warn('Could not load sessions:', e);
        } finally {
            setIsLoadingSessions(false);
        }
    };

    const openSession = async (session) => {
        closeDrawer();
        setIsLoadingHistory(true);
        setMessages([]);
        setSessionId(session.id);
        pendingNewSession.current = false;
        welcomeMessageSaved.current = true; // existing session, welcome already in DB
        Speech.stop();
        setSpeakingId(null);

        try {
            const data = await apiRequest(
                `/api/chat/history?locationId=${location.id}&sessionId=${session.id}`,
                'GET'
            );

            if (data?.session?.chatType === 'CROP') {
                if (data.session.pinnedMessage) {
                    setPinnedMessage(data.session.pinnedMessage);
                } else if (session.cropName) {
                    const sowingDateStr = session.sowingDate
                        ? new Date(session.sowingDate).toLocaleDateString('en-GB', {
                            day: '2-digit', month: '2-digit', year: 'numeric'
                          })
                        : 'Not specified';
                    setPinnedMessage(
                        `🌾 Crop: ${session.cropName}\n` +
                        `📅 Sown On: ${sowingDateStr}\n` +
                        `🧪 Fertilizer: N/A\n` +
                        `🐛 Issues: N/A`
                    );
                }
            } else {
                setPinnedMessage(null);
            }

            if (data?.data?.length > 0) {
                setMessages(data.data.map(msg => ({
                    id: msg.id,
                    text: msg.messageText,
                    isUser: msg.isFarmerMessage,
                    timestamp: msg.timestamp
                })));
            } else {
                const fallback = data?.session?.chatType === 'CROP' && session.cropName
                    ? getCropWelcomeMessage(session.cropName)
                    : getWelcomeMessage();
                setMessages([{ id: Date.now(), text: fallback, isUser: false }]);
            }
        } catch (e) {
            console.warn('Could not load session messages:', e);
            setPinnedMessage(null);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleStartNewChat = async () => {
        closeDrawer();
        setPinnedMessage(null);
        setSessionId(null);
        pendingNewSession.current = true;
        welcomeMessageSaved.current = false; // reset for new chat
        Speech.stop();
        setSpeakingId(null);
        if (location?.id) {
            try {
                await apiRequest('/api/chat/sessions/new', 'POST', {
                    locationId: location.id, chatType: 'GENERAL', cropName: null,
                });
            } catch (e) { console.warn('Could not archive old session:', e); }
        }
        setMessages([{ id: Date.now(), text: getWelcomeMessage(), isUser: false }]);
    };

    // ── Wave animation ────────────────────────────────────────────────
    useEffect(() => {
        let loop;
        if (isRecording) {
            loop = Animated.loop(
                Animated.sequence([
                    Animated.timing(waveAnim, { toValue: 1.3, duration: 500, useNativeDriver: true }),
                    Animated.timing(waveAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
                ])
            );
            loop.start();
        } else {
            waveAnim.setValue(1);
        }
        return () => { if (loop) loop.stop(); };
    }, [isRecording]);

    // ── Recording timer ───────────────────────────────────────────────
    useEffect(() => {
        if (isRecording) {
            recordingTimer.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
        } else {
            clearInterval(recordingTimer.current);
            setRecordingDuration(0);
        }
        return () => clearInterval(recordingTimer.current);
    }, [isRecording]);

    // ── Reset when farm switches ──────────────────────────────────────
    useEffect(() => {
        if (location?.id) {
            setMessages([]);
            setPinnedMessage(null);
            setSessionId(null);
            pendingNewSession.current = false;
            welcomeMessageSaved.current = false;
            Speech.stop();
            setSpeakingId(null);
        }
    }, [location?.id]);

    // ── Load chat when modal opens ────────────────────────────────────
    useEffect(() => {
        if (!isChatVisible || !user) return;
        const load = async () => {
            setIsLoadingHistory(true);
            try {
                const locationId = location?.id || '';

                // ── FIX ISSUE #2 ──────────────────────────────────────────────
                // 'Recommendation' chatType means the farmer just selected a crop
                // from the recommendation screen. pinnedMessage is already set in
                // AppContext by CropRecommendationScreen's handleCropSelect().
                // Treat it exactly like 'Advisory' so the pinned crop details are
                // preserved and shown correctly instead of being wiped.
                // ─────────────────────────────────────────────────────────────
                if (chatType === 'Recommendation') {
                    // pinnedMessage is already set by handleCropSelect — don't clear it.
                    // Show the crop-specific welcome immediately.
                    const cropLine = pinnedMessage?.split('\n').find(l => l.includes('Crop:'));
                    const cropNameClean = cropLine
                        ? cropLine.replace(/.*Crop:\s*/, '').replace(/[🌾]/g, '').trim()
                        : null;

                    setSessionId(null);
                    pendingNewSession.current = true;
                    welcomeMessageSaved.current = false;

                    const welcomeText = cropNameClean
                        ? getCropWelcomeMessage(cropNameClean)
                        : getWelcomeMessage();

                    setMessages([{ id: Date.now(), text: welcomeText, isUser: false }]);
                    setIsLoadingHistory(false);
                    return;
                }

                // GENERAL CHAT — always fresh, show welcome in farmer's language
                if (chatType !== 'Advisory') {
                    setPinnedMessage(null);
                    setSessionId(null);
                    pendingNewSession.current = true;
                    welcomeMessageSaved.current = false;
                    setMessages([{ id: Date.now(), text: getWelcomeMessage(), isUser: false }]);
                    setIsLoadingHistory(false);
                    return;
                }

                // ADVISORY CHAT
                if (location?.id) {
                    const savedPin = await AsyncStorage.getItem(`pinnedMessage_${location.id}`);
                    if (savedPin && savedPin !== pinnedMessage) setPinnedMessage(savedPin);
                }
                const currentPin = pinnedMessage || (location?.id ? await AsyncStorage.getItem(`pinnedMessage_${location.id}`) : null);
                const cropLine = currentPin?.split('\n').find(l => l.includes('Crop:'));
                const currentCropName = cropLine ? cropLine.replace(/.*Crop:\s*/, '').replace(/[🌾]/g, '').trim() : null;

                const sessionsData = await apiRequest(`/api/chat/sessions?locationId=${locationId}`, 'GET');
                const allCropSessions = sessionsData?.data?.cropSessions || [];
                const matchingSession = currentCropName
                    ? allCropSessions.find(s => s.isActive && s.cropName && s.cropName.toLowerCase() === currentCropName.toLowerCase())
                    : allCropSessions.find(s => s.isActive);

                if (matchingSession) {
                    if (sessionId === matchingSession.id) { setIsLoadingHistory(false); return; }
                    setSessionId(matchingSession.id);
                    pendingNewSession.current = false;
                    welcomeMessageSaved.current = true; // existing session

                    const histData = await apiRequest(
                        `/api/chat/history?locationId=${locationId}&sessionId=${matchingSession.id}`,
                        'GET'
                    );

                    if (histData?.session?.pinnedMessage) {
                        setPinnedMessage(histData.session.pinnedMessage);
                        if (location?.id) {
                            AsyncStorage.setItem(`pinnedMessage_${location.id}`, histData.session.pinnedMessage);
                        }
                    }

                    if (histData?.data?.length > 0) {
                        setMessages(histData.data.map(msg => ({
                            id: msg.id,
                            text: msg.messageText,
                            isUser: msg.isFarmerMessage,
                            timestamp: msg.timestamp
                        })));
                        setIsLoadingHistory(false);
                        return;
                    }
                } else {
                    setSessionId(null);
                    pendingNewSession.current = true;
                    welcomeMessageSaved.current = false;
                }

                if (currentPin) {
                    const cropNameClean = currentCropName || 'your crop';
                    setMessages([{ id: Date.now(), text: getCropWelcomeMessage(cropNameClean), isUser: false }]);
                } else {
                    setMessages([{ id: Date.now(), text: getWelcomeMessage(), isUser: false }]);
                }
            } catch (error) {
                console.error('Error loading chat:', error);
                setMessages([{ id: Date.now(), text: getWelcomeMessage(), isUser: false }]);
            } finally {
                setIsLoadingHistory(false);
            }
        };
        load();
    }, [isChatVisible, chatType, location?.id]);

    // ── Build AI prompt ───────────────────────────────────────────────
    const getAIResponse = async (userMessage) => {
        try {
            let contextBlock = '';
            if (pinnedMessage) contextBlock += `\nFarmer's Active Crop Info:\n${pinnedMessage}\n`;
            if (weatherData) {
                contextBlock +=
                    `\nCurrent Weather:\n` +
                    `- Temperature: ${weatherData.temperature ?? 'unknown'} °C\n` +
                    `- Humidity: ${weatherData.humidity ?? 'unknown'} %\n` +
                    `- Rainfall: ${weatherData.rainfall ?? 'unknown'} mm\n`;
            }
            if (location) {
                contextBlock += `\nFarmer's Location:\n`;
                if (location.village)  contextBlock += `- Village: ${location.village}\n`;
                if (location.district) contextBlock += `- District: ${location.district}\n`;
                if (location.state)    contextBlock += `- State: ${location.state}\n`;
                if (location.area)     contextBlock += `- Area: ${location.area}\n`;
            }

            const hasBengali = /[\u0980-\u09FF]/.test(userMessage);
            const hasHindi   = /[\u0900-\u097F]/.test(userMessage);
            let langInstruction = '';
            if (hasBengali) {
                langInstruction = 'CRITICAL: The farmer wrote in Bengali. You MUST respond ONLY in Bengali (বাংলা script). This applies to every reply including refusals — never switch to Hindi or English.\n';
            } else if (hasHindi) {
                langInstruction = 'CRITICAL: The farmer wrote in Hindi. You MUST respond ONLY in Hindi (Devanagari script). This applies to every reply including refusals — never switch to Bengali or English.\n';
            } else {
                langInstruction = 'CRITICAL: The farmer wrote in English. You MUST respond ONLY in English. This applies to every reply including refusals.\n';
            }

            let cropBoundaryInstruction = '';
            if (effectiveChatType === 'CROP' && pinnedMessage) {
                const cropLine = pinnedMessage.split('\n').find(l => l.includes('Crop:'));
                const activeCropName = cropLine
                    ? cropLine.replace(/.*Crop:\s*/, '').replace(/[🌾]/g, '').trim()
                    : null;

                if (activeCropName) {
                    if (hasBengali) {
                        cropBoundaryInstruction =
                            `CRITICAL RESTRICTION: এই চ্যাট শুধুমাত্র "${activeCropName}" সম্পর্কিত প্রশ্নের উত্তর দেবে। ` +
                            `যদি কৃষক অন্য কোনো ফসল সম্পর্কে প্রশ্ন করেন, তাহলে বিনম্রভাবে বলুন যে এই চ্যাটটি শুধুমাত্র ${activeCropName} এর জন্য। ` +
                            `সাধারণ ফসলের প্রশ্নের জন্য তাকে জেনারেল চ্যাট ব্যবহার করতে বলুন। অন্য ফসলের প্রশ্নের উত্তর কোনো অবস্থাতেই দেবেন না।\n`;
                    } else if (hasHindi) {
                        cropBoundaryInstruction =
                            `CRITICAL RESTRICTION: यह चैट केवल "${activeCropName}" से संबंधित सवालों का जवाब देगी। ` +
                            `अगर किसान किसी दूसरी फसल के बारे में पूछे, तो विनम्रता से बताएं कि यह चैट केवल ${activeCropName} के लिए है। ` +
                            `सामान्य फसल प्रश्नों के लिए उन्हें General Chat उपयोग करने को कहें। किसी भी दूसरी फसल का जवाब न दें।\n`;
                    } else {
                        cropBoundaryInstruction =
                            `CRITICAL RESTRICTION: This chat is ONLY for questions about "${activeCropName}". ` +
                            `If the farmer asks about any OTHER crop, you MUST politely refuse and tell them: ` +
                            `"This chat is specifically for your ${activeCropName} crop. For questions about other crops, please use the General Chat." ` +
                            `Do NOT answer questions about any crop other than ${activeCropName} under any circumstances.\n`;
                    }
                }
            }

            const fullPrompt = contextBlock
                ? `${langInstruction}${cropBoundaryInstruction}${contextBlock}\nFarmer's question: ${userMessage}`
                : `${langInstruction}${cropBoundaryInstruction}${userMessage}`;

            return await ask(fullPrompt);
        } catch (error) {
            console.error('AI Response Error:', error);
            return null;
        }
    };

    // ── Save to backend ───────────────────────────────────────────────
    const saveChatToBackend = async (userMessage, botReply, currentMessages) => {
        try {
            const cropLine = pinnedMessage?.split('\n').find(l => l.includes('Crop:'));
            const cropName = cropLine ? cropLine.replace(/.*Crop:\s*/, '').replace(/[🌾]/g, '').trim() : null;

            // If this is the first message of a fresh chat, explicitly create
            // a new session first so it never reuses the previous one.
            let currentSessionId = sessionId;
            if (pendingNewSession.current && !currentSessionId) {
                try {
                    const newSession = await apiRequest('/api/chat/sessions/new', 'POST', {
                        locationId: location?.id,
                        chatType: effectiveChatType,
                        cropName: effectiveChatType === 'CROP' ? cropName : null,
                    });
                    if (newSession?.sessionId || newSession?.data?.id) {
                        currentSessionId = newSession.sessionId || newSession.data.id;
                        setSessionId(currentSessionId);
                    }
                } catch (e) {
                    console.warn('Could not pre-create session:', e);
                }
                pendingNewSession.current = false;
            }

            // ── FIX: Save the welcome message on the very first exchange ──
            if (!welcomeMessageSaved.current) {
                const priorUserMessages = (currentMessages || []).filter(m => m.isUser);
                const isFirstExchange = priorUserMessages.length === 0;

                if (isFirstExchange) {
                    const welcomeText = effectiveChatType === 'CROP' && cropName
                        ? getCropWelcomeMessage(cropName)
                        : getWelcomeMessage();

                    try {
                        await apiRequest('/api/chat/advisory', 'POST', {
                            message: '__welcome__',
                            botReply: welcomeText,
                            language: lang,
                            chatType: effectiveChatType,
                            cropName: effectiveChatType === 'CROP' ? cropName : null,
                            pinnedMessage: effectiveChatType === 'CROP' ? pinnedMessage : null,
                            sessionId: currentSessionId,
                            isWelcomeMessage: true,
                        });
                        welcomeMessageSaved.current = true;
                    } catch (e) {
                        console.warn('Could not save welcome message:', e);
                    }
                }
            }

            const result = await apiRequest('/api/chat/advisory', 'POST', {
                message: userMessage,
                botReply,
                language: lang,
                chatType: effectiveChatType,
                cropName: effectiveChatType === 'CROP' ? cropName : null,
                pinnedMessage: effectiveChatType === 'CROP' ? pinnedMessage : null,
                sessionId: currentSessionId,
            });
            if (result?.sessionId && !sessionId) setSessionId(result.sessionId);
        } catch (error) {
            console.warn('Could not save chat:', error);
        }
    };

    // ── Send message ──────────────────────────────────────────────────
    const handleSend = async () => {
        if (!input.trim()) {
            Alert.alert('Message Required', 'Please type a message to send.');
            return;
        }
        const userText = input.trim();
        const userMsg = { id: Date.now(), text: userText, isUser: true };

        const messagesBeforeSend = [...messages];

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        try {
            const aiResponse = await getAIResponse(userText);
            if (aiResponse) {
                const botMsg = { id: Date.now() + 1, text: aiResponse, isUser: false };
                setMessages(prev => [...prev, botMsg]);
                await saveChatToBackend(userText, aiResponse, messagesBeforeSend);
            } else {
                Alert.alert('Unable to Connect', 'All API keys are busy. Please try again in a moment.');
                setMessages(prev => prev.filter(m => m.id !== userMsg.id));
            }
        } catch {
            Alert.alert('Something Went Wrong', 'Please try again in a moment.');
            setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        } finally {
            setIsTyping(false);
        }
    };

    // ── Transcribe audio using Groq Whisper API ───────────────────────
    const transcribeWithGroq = async (audioUri) => {
        const apiKeys = [
            process.env.EXPO_PUBLIC_GROQ_KEY_1,
            process.env.EXPO_PUBLIC_GROQ_KEY_2,
            process.env.EXPO_PUBLIC_GROQ_KEY_3,
            process.env.EXPO_PUBLIC_GROQ_KEY_4,
            process.env.EXPO_PUBLIC_GROQ_KEY_5,
            process.env.EXPO_PUBLIC_GROQ_KEY_6,
        ].filter(Boolean);

        if (apiKeys.length === 0) throw new Error('No Groq API keys found');

        for (let i = 0; i < apiKeys.length; i++) {
            try {
                console.log(`Whisper: trying key ${i + 1} of ${apiKeys.length}...`);

                const formData = new FormData();
                formData.append('file', {
                    uri: audioUri,
                    type: 'audio/m4a',
                    name: 'voice.m4a',
                });
                formData.append('model', 'whisper-large-v3');
                formData.append('response_format', 'json');
                formData.append('prompt',
                    'This is a farmer asking questions about agriculture in India. ' +
                    'Common words: sow, crop, fertilizer, irrigation, harvest, pesticide, soil, rice, wheat, cotton, barley, ' +
                    'ফসল, বীজ, সার, সেচ, মাটি, আবহাওয়া, চাষ, ধান, গম, তুলা, ' +
                    'फसल, बीज, खाद, सिंचाई, मिट्टी, मौसम, खेती, धान, गेहूं, कपास'
                );

                const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKeys[i]}` },
                    body: formData,
                });

                if (!response.ok) {
                    const errText = await response.text();
                    if (response.status === 429) {
                        console.warn(`⚠️ Whisper key ${i + 1} rate limited. Trying next...`);
                        continue;
                    }
                    console.error('Whisper API error:', response.status, errText);
                    throw new Error(`Transcription failed: ${response.status}`);
                }

                const data = await response.json();
                console.log(`✅ Whisper key ${i + 1} worked!`);
                return data.text?.trim() || '';

            } catch (error) {
                if (error.message?.includes('429') || error.message?.includes('rate_limit')) {
                    console.warn(`⚠️ Whisper key ${i + 1} rate limited. Trying next...`);
                    continue;
                }
                if (i === apiKeys.length - 1) throw error;
                console.warn(`⚠️ Whisper key ${i + 1} failed: ${error.message}. Trying next...`);
            }
        }

        throw new Error('All Whisper API keys exhausted.');
    };

    // ── Voice recording ───────────────────────────────────────────────
    const handleMicPress = async () => {
        if (isRecording) {
            setIsRecording(false);
            if (!recording) return;

            try {
                await recording.stopAndUnloadAsync();
                await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
                const uri = recording.getURI();
                setRecording(null);

                if (!uri) {
                    Alert.alert('Error', 'Could not get recording. Please try again.');
                    return;
                }

                setIsTranscribing(true);
                const transcribedText = await transcribeWithGroq(uri);

                if (!transcribedText) {
                    Alert.alert('Could not hear you', 'Please speak clearly and try again.');
                    return;
                }

                setInput(transcribedText);

            } catch (error) {
                console.error('Voice processing error:', error);
                Alert.alert('Voice Error', 'Could not process your voice. Please try again or type your question.');
            } finally {
                setIsTranscribing(false);
                setRecording(null);
            }

        } else {
            try {
                Speech.stop();
                setSpeakingId(null);

                if (permissionResponse?.status !== 'granted') {
                    const { status } = await Audio.requestPermissionsAsync();
                    if (status !== 'granted') {
                        Alert.alert('Permission Required', 'Microphone permission is needed to record voice messages.');
                        return;
                    }
                }

                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                });

                const { recording: newRecording } = await Audio.Recording.createAsync(
                    Audio.RecordingOptionsPresets.HIGH_QUALITY
                );

                setRecording(newRecording);
                setIsRecording(true);

            } catch (err) {
                console.error('Failed to start recording:', err);
                Alert.alert('Error', 'Could not start recording. Please try again.');
            }
        }
    };

    const formatDuration = (s) => `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`;
    const formatSessionDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // ── FIX ISSUE #3: close handler always navigates to Home ─────────
    const handleClose = () => {
        Speech.stop();
        setSpeakingId(null);
        setChatVisible(false);
        // Always go home regardless of chatType so the farmer is never
        // left on the Recommendation or Advisory stack screen.
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        <Modal visible={isChatVisible} animationType="slide" transparent={false}>
            <StatusBar barStyle="light-content" backgroundColor="#2E7D32" />
            <ImageBackground
                source={chatBackground || require('../assets/truck.jpg')}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.container}>

                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={openDrawer} style={styles.headerIconBtn}>
                                <Ionicons name="menu" size={28} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.headerCenter}>
                                <Ionicons name="leaf" size={22} color="#fff" />
                                <Text style={styles.headerText}>ShasyaSathi</Text>
                            </View>
                            {/* ── FIX ISSUE #3: always navigate home on close ── */}
                            <TouchableOpacity onPress={handleClose} style={styles.headerIconBtn}>
                                <Ionicons name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {/* Chat Body */}
                        <ScrollView
                            ref={scrollViewRef}
                            style={styles.chatBody}
                            contentContainerStyle={styles.chatContent}
                            showsVerticalScrollIndicator={false}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                        >
                            {isLoadingHistory ? (
                                <View style={styles.loadingHistory}>
                                    <ActivityIndicator size="small" color="#2E7D32" />
                                    <Text style={styles.loadingText}>Loading conversation...</Text>
                                </View>
                            ) : (
                                <>
                                    {pinnedMessage && (
                                        <View style={styles.pinnedBox}>
                                            <View style={styles.pinnedHeader}>
                                                <Ionicons name="pin" size={16} color="#2E7D32" />
                                                <Text style={styles.pinnedTitle}>Crop Details</Text>
                                            </View>
                                            <Text style={styles.pinnedText}>{pinnedMessage}</Text>
                                        </View>
                                    )}

                                    {messages.map(m => (
                                        <View key={m.id}>
                                            <ChatMessage message={m} />
                                            {!m.isUser && (
                                                <TouchableOpacity
                                                    style={styles.speakButton}
                                                    onPress={() => handleSpeak(m)}
                                                >
                                                    <Ionicons
                                                        name={speakingId === m.id ? 'stop-circle' : 'volume-high'}
                                                        size={15}
                                                        color={speakingId === m.id ? '#D32F2F' : '#2E7D32'}
                                                    />
                                                    <Text style={[
                                                        styles.speakButtonText,
                                                        speakingId === m.id && styles.speakButtonTextStop
                                                    ]}>
                                                        {speakingId === m.id ? ' Stop' : ' Speak'}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}

                                    {isTyping && (
                                        <View style={styles.typingIndicator}>
                                            <ActivityIndicator size="small" color="#2E7D32" />
                                            <Text style={styles.typingText}>Krishi Sathi is thinking...</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </ScrollView>

                        {/* Recording / Transcribing Indicator */}
                        {(isRecording || isTranscribing) && (
                            <Animated.View style={[
                                styles.recordingIndicator,
                                { transform: isRecording ? [{ scale: waveAnim }] : [] }
                            ]}>
                                <Ionicons
                                    name={isTranscribing ? 'hourglass' : 'mic'}
                                    size={22}
                                    color="#fff"
                                />
                                {isRecording && (
                                    <>
                                        <Text style={styles.recordingText}>{formatDuration(recordingDuration)}</Text>
                                        <View style={styles.recordingWave}>
                                            <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim }] }]} />
                                            <Animated.View style={[styles.waveBar, { transform: [{ scaleY: Animated.multiply(waveAnim, 1.2) }] }]} />
                                            <Animated.View style={[styles.waveBar, { transform: [{ scaleY: waveAnim }] }]} />
                                        </View>
                                    </>
                                )}
                                <Text style={styles.cancelHint}>
                                    {isTranscribing ? 'Converting speech...' : 'Tap 🎤 again to stop'}
                                </Text>
                            </Animated.View>
                        )}

                        {/* Input Area */}
                        <View style={styles.inputArea}>
                            <TextInput
                                style={styles.input}
                                placeholder={isRecording ? 'Recording...' : isTranscribing ? 'Converting...' : 'Type your question...'}
                                placeholderTextColor="#999"
                                value={input}
                                onChangeText={setInput}
                                multiline
                                editable={!isLoadingHistory && !isTyping && !isRecording && !isTranscribing}
                            />
                            <TouchableOpacity
                                style={[styles.actionButton, styles.sendButton]}
                                onPress={handleSend}
                                disabled={isTyping || isRecording || isTranscribing}
                            >
                                <Ionicons name="send" size={22} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButton, isRecording ? styles.micButtonRecording : styles.micButton]}
                                onPress={handleMicPress}
                                disabled={isTyping || isTranscribing}
                            >
                                <Ionicons name={isRecording ? 'stop' : 'mic'} size={22} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Drawer Overlay */}
                    {drawerOpen && (
                        <TouchableWithoutFeedback onPress={closeDrawer}>
                            <View style={styles.overlay} />
                        </TouchableWithoutFeedback>
                    )}

                    {/* Drawer */}
                    <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
                        <SafeAreaView style={{ flex: 1 }}>
                            <View style={styles.drawerHeader}>
                                <Ionicons name="chatbubbles" size={24} color="#fff" />
                                <Text style={styles.drawerHeaderText}>Chat History</Text>
                            </View>
                            <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false}>
                                <TouchableOpacity style={styles.newChatBtn} onPress={handleStartNewChat}>
                                    <Ionicons name="add-circle-outline" size={22} color="#fff" />
                                    <Text style={styles.newChatBtnText}>Start New Chat</Text>
                                </TouchableOpacity>

                                {isLoadingSessions ? (
                                    <ActivityIndicator size="small" color="#2E7D32" style={{ marginTop: 20 }} />
                                ) : (
                                    <>
                                        {/* My Crop Chats */}
                                        <TouchableOpacity style={styles.sectionHeader} onPress={() => setCropDropdownOpen(p => !p)}>
                                            <View style={styles.sectionHeaderLeft}>
                                                <Ionicons name="leaf" size={18} color="#2E7D32" />
                                                <Text style={styles.sectionHeaderText}>My Crop Chats</Text>
                                                <View style={styles.badge}><Text style={styles.badgeText}>{cropSessions.length}</Text></View>
                                            </View>
                                            <Ionicons name={cropDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#555" />
                                        </TouchableOpacity>
                                        {cropDropdownOpen && (
                                            <View style={styles.sectionContent}>
                                                {cropSessions.length === 0 ? (
                                                    <Text style={styles.emptyText}>No crop chats yet</Text>
                                                ) : cropSessions.map(session => (
                                                    <TouchableOpacity
                                                        key={session.id}
                                                        style={[styles.sessionItem, session.isActive && styles.sessionItemActive]}
                                                        onPress={() => openSession(session)}
                                                    >
                                                        <View style={styles.sessionIcon}>
                                                            <Ionicons name="leaf" size={16} color={session.isActive ? '#2E7D32' : '#888'} />
                                                        </View>
                                                        <View style={styles.sessionInfo}>
                                                            <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                                                            <Text style={styles.sessionDate}>{formatSessionDate(session.createdAt)}</Text>
                                                            {session.messages?.[0] && (
                                                                <Text style={styles.sessionPreview} numberOfLines={1}>{session.messages[0].messageText}</Text>
                                                            )}
                                                        </View>
                                                        {session.isActive && (
                                                            <View style={styles.activeTag}><Text style={styles.activeTagText}>Active</Text></View>
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}

                                        {/* General Questions */}
                                        <TouchableOpacity style={styles.sectionHeader} onPress={() => setGeneralDropdownOpen(p => !p)}>
                                            <View style={styles.sectionHeaderLeft}>
                                                <Ionicons name="help-circle" size={18} color="#FF8F00" />
                                                <Text style={styles.sectionHeaderText}>General Questions</Text>
                                                <View style={[styles.badge, { backgroundColor: '#FF8F00' }]}><Text style={styles.badgeText}>{generalSessions.length}</Text></View>
                                            </View>
                                            <Ionicons name={generalDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#555" />
                                        </TouchableOpacity>
                                        {generalDropdownOpen && (
                                            <View style={styles.sectionContent}>
                                                {generalSessions.length === 0 ? (
                                                    <Text style={styles.emptyText}>No general chats yet</Text>
                                                ) : generalSessions.map(session => (
                                                    <TouchableOpacity
                                                        key={session.id}
                                                        style={[styles.sessionItem, session.isActive && styles.sessionItemActive]}
                                                        onPress={() => openSession(session)}
                                                    >
                                                        <View style={styles.sessionIcon}>
                                                            <Ionicons name="chatbubble-outline" size={16} color={session.isActive ? '#FF8F00' : '#888'} />
                                                        </View>
                                                        <View style={styles.sessionInfo}>
                                                            <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                                                            <Text style={styles.sessionDate}>{formatSessionDate(session.createdAt)}</Text>
                                                            {session.messages?.[0] && (
                                                                <Text style={styles.sessionPreview} numberOfLines={1}>{session.messages[0].messageText}</Text>
                                                            )}
                                                        </View>
                                                        {session.isActive && (
                                                            <View style={[styles.activeTag, { backgroundColor: '#FF8F00' }]}><Text style={styles.activeTagText}>Active</Text></View>
                                                        )}
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </>
                                )}
                            </ScrollView>
                        </SafeAreaView>
                    </Animated.View>

                </SafeAreaView>
            </ImageBackground>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backgroundImage: { flex: 1, width: '100%', height: '100%' },
    safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
    container: { flex: 1, backgroundColor: 'rgba(255,255,255,0.75)' },
    header: {
        backgroundColor: '#2E7D32', paddingVertical: 14, paddingHorizontal: 12,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 4,
    },
    headerIconBtn: { padding: 4 },
    headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 6 },
    chatBody: { flex: 1 },
    chatContent: { paddingVertical: 20, paddingHorizontal: 15 },
    loadingHistory: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    loadingText: { marginTop: 10, fontSize: 14, color: '#666' },
    pinnedBox: {
        backgroundColor: '#FFF9E6', borderRadius: 12, padding: 12, marginBottom: 15,
        borderWidth: 1, borderColor: '#FF8F00', elevation: 2,
    },
    pinnedHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    pinnedTitle: { fontSize: 14, fontWeight: 'bold', color: '#2E7D32', marginLeft: 5, flex: 1 },
    pinnedText: { fontSize: 14, color: '#333', lineHeight: 22 },
    speakButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginLeft: 4,
        marginTop: 4,
        marginBottom: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: '#E8F5E9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#A5D6A7',
    },
    speakButtonText: { fontSize: 12, color: '#2E7D32', fontWeight: '600' },
    speakButtonTextStop: { color: '#D32F2F' },
    typingIndicator: {
        flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
        marginLeft: 10, marginVertical: 10, backgroundColor: '#E8F5E9',
        padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#2E7D32',
    },
    typingText: { marginLeft: 8, color: '#1B5E20', fontSize: 14, fontStyle: 'italic' },
    inputArea: {
        flexDirection: 'row', padding: 15, backgroundColor: 'rgba(255,255,255,0.95)',
        borderTopWidth: 1, borderTopColor: '#ddd', alignItems: 'flex-end',
    },
    input: {
        flex: 1, backgroundColor: '#f5f5f5', borderRadius: 25,
        paddingHorizontal: 18, paddingVertical: 10, marginRight: 10,
        maxHeight: 100, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0',
    },
    actionButton: {
        width: 45, height: 45, borderRadius: 23,
        justifyContent: 'center', alignItems: 'center', marginLeft: 5, elevation: 3,
    },
    sendButton: { backgroundColor: '#2E7D32' },
    micButton: { backgroundColor: '#FF8F00' },
    micButtonRecording: { backgroundColor: '#D32F2F' },
    recordingIndicator: {
        position: 'absolute', bottom: 100, alignSelf: 'center',
        backgroundColor: '#D32F2F', flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 20, borderRadius: 30, elevation: 5, zIndex: 1000,
    },
    recordingText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8, marginRight: 12 },
    recordingWave: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
    waveBar: { width: 4, height: 20, backgroundColor: '#fff', marginHorizontal: 2, borderRadius: 2 },
    cancelHint: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginLeft: 8 },
    overlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10,
    },
    drawer: {
        position: 'absolute', top: 0, bottom: 0, left: 0, width: DRAWER_WIDTH,
        backgroundColor: '#fff', elevation: 20, zIndex: 20,
        shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    drawerHeader: {
        backgroundColor: '#2E7D32', flexDirection: 'row', alignItems: 'center',
        padding: 18, paddingTop: 22, gap: 10,
    },
    drawerHeaderText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
    drawerScroll: { flex: 1 },
    newChatBtn: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E7D32',
        margin: 14, padding: 14, borderRadius: 12, gap: 10, elevation: 2,
    },
    newChatBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 6 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa',
    },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionHeaderText: { fontSize: 14, fontWeight: '700', color: '#333', marginLeft: 6 },
    badge: {
        backgroundColor: '#2E7D32', borderRadius: 10, minWidth: 20, height: 20,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, marginLeft: 6,
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
    sectionContent: { backgroundColor: '#fff' },
    sessionItem: {
        flexDirection: 'row', alignItems: 'flex-start', padding: 14,
        borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    },
    sessionItemActive: { backgroundColor: '#f0faf0' },
    sessionIcon: {
        width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5',
        justifyContent: 'center', alignItems: 'center', marginRight: 10, marginTop: 2,
    },
    sessionInfo: { flex: 1 },
    sessionTitle: { fontSize: 13, fontWeight: '600', color: '#222', marginBottom: 2 },
    sessionDate: { fontSize: 11, color: '#999', marginBottom: 2 },
    sessionPreview: { fontSize: 12, color: '#666', fontStyle: 'italic' },
    activeTag: {
        backgroundColor: '#2E7D32', borderRadius: 8, paddingHorizontal: 7,
        paddingVertical: 3, alignSelf: 'flex-start', marginLeft: 6,
    },
    activeTagText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    emptyText: { color: '#aaa', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
});

export default FloatingChatbot;