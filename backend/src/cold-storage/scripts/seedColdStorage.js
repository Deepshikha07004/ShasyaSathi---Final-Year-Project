/**
 * Cold Storage Seed Script — updated from WEST_BENGAL_WAREHOUSE_DATA_(4).xlsx
 * Run once from your backend folder:
 *   node cold-storage/scripts/seedColdStorage.js
 *
 * To fully re-seed (wipe + re-create):
 *   npx prisma db execute --stdin <<< "DELETE FROM \"ColdStorageCrop\"; DELETE FROM \"ColdStorage\";"
 *   node cold-storage/scripts/seedColdStorage.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ─── All crops (existing + cotton added from Excel) ───────────────────────────
const ALL_CROPS = [
  { id: 'crop-rice',        cropNameEn: 'Rice',         cropNameHi: 'चावल',        cropNameBn: 'ধান',          waterRequirement: 'HIGH',   suitableClimate: 'MONSOON',    growingDurationDays: 120 },
  { id: 'crop-wheat',       cropNameEn: 'Wheat',        cropNameHi: 'गेहूं',       cropNameBn: 'গম',           waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',     growingDurationDays: 120 },
  { id: 'crop-maize',       cropNameEn: 'Maize',        cropNameHi: 'मक्का',       cropNameBn: 'ভুট্টা',       waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',     growingDurationDays: 90  },
  { id: 'crop-cotton',      cropNameEn: 'Cotton',       cropNameHi: 'कपास',        cropNameBn: 'তুলা',         waterRequirement: 'LOW',    suitableClimate: 'SUMMER',     growingDurationDays: 180 },
  { id: 'crop-potato',      cropNameEn: 'Potato',       cropNameHi: 'आलू',         cropNameBn: 'আলু',          waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',     growingDurationDays: 90  },
  { id: 'crop-tomato',      cropNameEn: 'Tomato',       cropNameHi: 'टमाटर',       cropNameBn: 'টমেটো',        waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON', growingDurationDays: 75  },
  { id: 'crop-onion',       cropNameEn: 'Onion',        cropNameHi: 'प्याज',       cropNameBn: 'পেঁয়াজ',      waterRequirement: 'LOW',    suitableClimate: 'WINTER',     growingDurationDays: 120 },
  { id: 'crop-jute',        cropNameEn: 'Jute',         cropNameHi: 'जूट',         cropNameBn: 'পাট',          waterRequirement: 'HIGH',   suitableClimate: 'MONSOON',    growingDurationDays: 120 },
  { id: 'crop-banana',      cropNameEn: 'Banana',       cropNameHi: 'केला',        cropNameBn: 'কলা',          waterRequirement: 'HIGH',   suitableClimate: 'ALL_SEASON', growingDurationDays: 270 },
  { id: 'crop-mango',       cropNameEn: 'Mango',        cropNameHi: 'आम',          cropNameBn: 'আম',           waterRequirement: 'LOW',    suitableClimate: 'SUMMER',     growingDurationDays: 180 },
  { id: 'crop-guava',       cropNameEn: 'Guava',        cropNameHi: 'अमरूद',       cropNameBn: 'পেয়ারা',      waterRequirement: 'LOW',    suitableClimate: 'ALL_SEASON', growingDurationDays: 150 },
  { id: 'crop-litchi',      cropNameEn: 'Litchi',       cropNameHi: 'लीची',        cropNameBn: 'লিচু',         waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',     growingDurationDays: 120 },
  { id: 'crop-pineapple',   cropNameEn: 'Pineapple',    cropNameHi: 'अनानास',      cropNameBn: 'আনারস',        waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON', growingDurationDays: 365 },
  { id: 'crop-orange',      cropNameEn: 'Orange',       cropNameHi: 'संतरा',       cropNameBn: 'কমলা',         waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',     growingDurationDays: 365 },
  { id: 'crop-tea',         cropNameEn: 'Tea',          cropNameHi: 'चाय',         cropNameBn: 'চা',           waterRequirement: 'HIGH',   suitableClimate: 'ALL_SEASON', growingDurationDays: 365 },
  { id: 'crop-cabbage',     cropNameEn: 'Cabbage',      cropNameHi: 'पत्तागोभी',   cropNameBn: 'বাঁধাকপি',     waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',     growingDurationDays: 90  },
  { id: 'crop-brinjal',     cropNameEn: 'Brinjal',      cropNameHi: 'बैंगन',       cropNameBn: 'বেগুন',        waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON', growingDurationDays: 90  },
  { id: 'crop-cauliflower', cropNameEn: 'Cauliflower',  cropNameHi: 'फूलगोभी',     cropNameBn: 'ফুলকপি',       waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',     growingDurationDays: 90  },
  { id: 'crop-carrot',      cropNameEn: 'Carrot',       cropNameHi: 'गाजर',        cropNameBn: 'গাজর',         waterRequirement: 'MEDIUM', suitableClimate: 'WINTER',     growingDurationDays: 75  },
  { id: 'crop-beans',       cropNameEn: 'Beans',        cropNameHi: 'बीन्स',       cropNameBn: 'বিন',          waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON', growingDurationDays: 60  },
  { id: 'crop-cucumber',    cropNameEn: 'Cucumber',     cropNameHi: 'खीरा',        cropNameBn: 'শশা',          waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',     growingDurationDays: 60  },
  { id: 'crop-pumpkin',     cropNameEn: 'Pumpkin',      cropNameHi: 'कद्दू',       cropNameBn: 'কুমড়ো',       waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON', growingDurationDays: 90  },
  { id: 'crop-chilli',      cropNameEn: 'Chilli',       cropNameHi: 'मिर्च',       cropNameBn: 'মরিচ',         waterRequirement: 'MEDIUM', suitableClimate: 'ALL_SEASON', growingDurationDays: 90  },
  { id: 'crop-coriander',   cropNameEn: 'Coriander',    cropNameHi: 'धनिया',       cropNameBn: 'ধনে',          waterRequirement: 'LOW',    suitableClimate: 'WINTER',     growingDurationDays: 40  },
  { id: 'crop-ladyfinger',  cropNameEn: 'Ladyfinger',   cropNameHi: 'भिंडी',       cropNameBn: 'ঢেঁড়স',       waterRequirement: 'MEDIUM', suitableClimate: 'SUMMER',     growingDurationDays: 60  },
  { id: 'crop-cashew',      cropNameEn: 'Cashew',       cropNameHi: 'काजू',        cropNameBn: 'কাজু',         waterRequirement: 'LOW',    suitableClimate: 'SUMMER',     growingDurationDays: 365 },
  { id: 'crop-coconut',     cropNameEn: 'Coconut',      cropNameHi: 'नारियल',      cropNameBn: 'নারকেল',       waterRequirement: 'HIGH',   suitableClimate: 'ALL_SEASON', growingDurationDays: 365 },
];

// ─── Commodity name → crop ID map ─────────────────────────────────────────────
const COMMODITY_MAP = {
  'rice':         'crop-rice',
  'wheat':        'crop-wheat',
  'maize':        'crop-maize',
  'cotton':       'crop-cotton',
  'potato':       'crop-potato',
  'tomato':       'crop-tomato',
  'onion':        'crop-onion',
  'jute':         'crop-jute',
  'banana':       'crop-banana',
  'mango':        'crop-mango',
  'guava':        'crop-guava',
  'litchi':       'crop-litchi',
  'pineapple':    'crop-pineapple',
  'orange':       'crop-orange',
  'tea':          'crop-tea',
  'cabbage':      'crop-cabbage',
  'brinjal':      'crop-brinjal',
  'eggplant':     'crop-brinjal',
  'cauliflower':  'crop-cauliflower',
  'carrot':       'crop-carrot',
  'carrots':      'crop-carrot',
  'beans':        'crop-beans',
  'cucumber':     'crop-cucumber',
  'pumpkin':      'crop-pumpkin',
  'chilli':       'crop-chilli',
  'green chilli': 'crop-chilli',
  'coriander':    'crop-coriander',
  'ladyfinger':   'crop-ladyfinger',
  'cashew':       'crop-cashew',
  'coconut':      'crop-coconut',
};

// ─── 57 warehouses — sourced from WEST_BENGAL_WAREHOUSE_DATA_(4).xlsx ─────────
const WAREHOUSES = [
  {
    name: "State Warehousing Corporation KRISHNANAGAR",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন কৃষ্ণনগর",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन कृष्णनगर",
    address: "3, JN Roy Bahadur Rd, Krishnanagar, West Bengal 741101, India",
    district: "Nadia", state: "West Bengal", capacity: 7585,
    ownerContact: "9331217346",
    // Excel: rice, potato, banana, guava, cotton
    commodities: ["rice","potato","banana","guava","cotton"],
    latitude: 23.39803, longitude: 88.4945649,
  },
  {
    name: "State Warehousing Corporation BANKURA",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন বাঁকুড়া",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन बांकुरा",
    address: "62RM+GF6, Ailakundi P, West Bengal 722102, India",
    district: "Bankura", state: "West Bengal", capacity: 5579,
    ownerContact: "9331217346",
    // Excel: rice, mango, guava, cotton
    commodities: ["rice","mango","guava","cotton"],
    latitude: 23.2412842, longitude: 87.03363709999999,
  },
  {
    name: "State Warehousing Corporation KALIYAGANJ",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন কালিয়াগঞ্জ",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन कालियागंज",
    address: "J8HG+MF8, Kunore Rd, Seth Colony, Roy Colony, Kaliyaganj, West Bengal 733129, India",
    district: "Uttar Dinajpur", state: "West Bengal", capacity: 9195,
    ownerContact: "9331217346",
    commodities: ["rice","maize"],
    latitude: 25.6291545, longitude: 88.326213,
  },
  {
    name: "State Warehousing Corporation TARAKESWAR",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন তারকেশ্বর",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन तारकेश्वर",
    address: "V2H7+FP7, Saradapally, Tarkeshwar, West Bengal 712410, India",
    district: "Hooghly", state: "West Bengal", capacity: 10800,
    ownerContact: "9331217346",
    commodities: ["rice","potato","litchi","guava"],
    latitude: 22.8786554, longitude: 88.01429399999999,
  },
  {
    name: "State Warehousing Corporation JALPAIGURI",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন জলপাইগুড়ি",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन जलपाईगुड़ी",
    address: "DBC Rd, West Bengal, India",
    district: "Jalpaiguri", state: "West Bengal", capacity: 4871,
    ownerContact: "9331217346",
    commodities: ["rice","maize","tea","orange"],
    latitude: 26.5134481, longitude: 88.6992674,
  },
  {
    name: "State Warehousing Corporation NEW JALPAIGURI",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন নিউ জলপাইগুড়ি",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन न्यू जलपाईगुड़ी",
    address: "Satellite Township, Kamrangaguri, Siliguri, West Bengal 734015, India",
    district: "Jalpaiguri", state: "West Bengal", capacity: 24540,
    ownerContact: "9331217346",
    commodities: ["rice","maize","tea","pineapple","orange"],
    latitude: 26.6735665, longitude: 88.41441119999999,
  },
  {
    name: "State Warehousing Corporation BALURGHAT",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন বালুরঘাট",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन बालुरघाट",
    address: "6QPM+W67, Balurghat, West Bengal 733103, India",
    district: "Dakshin Dinajpur", state: "West Bengal", capacity: 4950,
    ownerContact: "9331217346",
    commodities: ["rice","maize"],
    latitude: 25.2372834, longitude: 88.7830612,
  },
  {
    name: "State Warehousing Corporation RAIGANJ",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন রায়গঞ্জ",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन रायगंज",
    address: "NH 12, West Bengal, India",
    district: "Uttar Dinajpur", state: "West Bengal", capacity: 7884,
    ownerContact: "9331217346",
    commodities: ["rice","maize"],
    latitude: 23.7237726, longitude: 88.2935844,
  },
  {
    name: "State Warehousing Corporation RANAGHAT",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন রানাঘাট",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन रनाघाट",
    address: "5HP7+H34, Aistala, West Bengal 741201, India",
    district: "Nadia", state: "West Bengal", capacity: 6085,
    ownerContact: "9331217346",
    commodities: ["rice","cabbage","brinjal"],
    latitude: 23.1863899, longitude: 88.5627038,
  },
  {
    name: "State Warehousing Corporation ALIPURDUAR",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন আলিপুরদুয়ার",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन अलीपुरद्वार",
    address: "Alipurduar, West Bengal, India",
    district: "Jalpaiguri", state: "West Bengal", capacity: 5716,
    ownerContact: "9331217346",
    commodities: ["rice","maize","tea","pineapple"],
    latitude: 26.4922164, longitude: 89.5319627,
  },
  {
    name: "State Warehousing Corporation DINHATA",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন দিনহাটা",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन दिनहाटा",
    address: "1, Dinhata Main Rd, Dinhata, West Bengal 736135, India",
    district: "Cooch Behar", state: "West Bengal", capacity: 6652,
    ownerContact: "9331217346",
    commodities: ["rice","cucumber","tomato"],
    latitude: 26.1153353, longitude: 89.4666879,
  },
  {
    name: "State Warehousing Corporation MALDA",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন মালদা",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन मालदा",
    address: "246M+W8Q, Malda, West Bengal 732102, India",
    district: "Malda", state: "West Bengal", capacity: 9491,
    ownerContact: "9331217346",
    // Excel: rice, maize, mango, cotton
    commodities: ["rice","maize","mango","cotton"],
    latitude: 25.0123375, longitude: 88.13335939999999,
  },
  {
    name: "State Warehousing Corporation GARBETA",
    nameBn: "স্টেট ওয়্যারহাউজিং কর্পোরেশন গড়বেতা",
    nameHi: "स्टेट वेयरहाउसिंग कॉर्पोरेशन गड़बेटा",
    address: "V973+7G2, Garhbeta, West Bengal 721127, India",
    district: "Paschim Medinipur", state: "West Bengal", capacity: 6002,
    ownerContact: "9331217346",
    // Excel: rice, carrots, cashew, cotton
    commodities: ["rice","carrots","cashew","cotton"],
    latitude: 22.8631347, longitude: 87.3537738,
  },
  {
    name: "SUSAMA RANI KONER",
    nameBn: "সুশমা রাণী কোনের",
    nameHi: "सुषमा रानी कोनेर",
    address: "GM68+P2G, Ausgram, West Bengal 713152, India",
    district: "Purba Bardhaman", state: "West Bengal", capacity: 6800,
    ownerContact: "9434008966",
    commodities: ["rice","potato","wheat","brinjal"],
    latitude: 23.5118192, longitude: 87.66506319999999,
  },
  {
    name: "Steinweg Sharaf India Pvt Ltd C/O Jai Matadi Commercial Warehouse",
    nameBn: "স্টাইনওয়েগ শরাফ ইন্ডিয়া প্রাইভেট লিমিটেড সি/ও জয় মাতাদি কমার্শিয়াল ওয়্যারহাউস",
    nameHi: "स्टाइनवेग शराफ इंडिया प्राइवेट लिमिटेड सी/ओ जय मातादी कमर्शियल वेयरहाउस",
    address: "NH-6, Jala kendua, Dhulagori, Howrah, West Bengal 711322, India",
    district: "Kolkata", state: "West Bengal", capacity: 2311,
    ownerContact: "9909040127",
    // Excel: rice, chilli, brinjal, cotton
    commodities: ["rice","chilli","brinjal","cotton"],
    latitude: 22.555034, longitude: 88.1585845,
  },
  {
    name: "Sonai Food Marketing Private Limited",
    nameBn: "সোনাই ফুড মার্কেটিং প্রাইভেট লিমিটেড",
    nameHi: "सोनाई फूड मार्केटिंग प्राइवेट लिमिटेड",
    address: "PS Jamalpur, Plot No 3974, Abujhati, West Bengal 713166, India",
    district: "Purba Bardhaman", state: "West Bengal", capacity: 1196,
    ownerContact: "9748778470",
    commodities: ["rice","wheat"],
    latitude: 23.0605419, longitude: 88.11043,
  },
  {
    name: "RANA CHOWDHURY",
    nameBn: "রানা চৌধুরী",
    nameHi: "राना चौधरी",
    address: "DBC Rd, West Bengal, India",
    district: "Jalpaiguri", state: "West Bengal", capacity: 5000,
    ownerContact: "9434001197",
    commodities: ["rice","maize","tea","orange"],
    latitude: 26.5134481, longitude: 88.6992674,
  },
  {
    name: "Nowrangroy Agro Pvt Ltd",
    nameBn: "নওরংরয় অ্যাগ্রো প্রাইভেট লিমিটেড",
    nameHi: "नवरंगरॉय एग्रो प्राइवेट लिमिटेड",
    address: "Amta - Ranihati Rd, Mallik Bagan, West Bengal, India",
    district: "Howrah", state: "West Bengal", capacity: 3371,
    ownerContact: "9836060999",
    commodities: ["rice","potato","cauliflower"],
    latitude: 22.5659857, longitude: 88.1399817,
  },
  {
    name: "Ramnagar Agro Biotech Co.",
    nameBn: "রামনগর অ্যাগ্রো বায়োটেক কো.",
    nameHi: "रामनगर एग्रो बायोटेक कंपनी",
    address: "Ramnagar, Saiyadpur, West Bengal 721441, India",
    district: "Purba Medinipur", state: "West Bengal", capacity: 1110,
    ownerContact: "9748777189",
    commodities: ["rice","maize","carrot","coconut"],
    latitude: 21.6745057, longitude: 87.55930839999999,
  },
  {
    name: "SATYANARAYAN FLOUR INDUSTRIES",
    nameBn: "সত্যনারায়ণ ফ্লাওয়ার ইন্ডাস্ট্রিজ",
    nameHi: "सत्यानारायण फ्लौर इंडस्ट्रीज",
    address: "Chandur, West Bengal 712410, India",
    district: "Hooghly", state: "West Bengal", capacity: 2020,
    ownerContact: "9800110126",
    commodities: ["rice","potato","beans","litchi"],
    latitude: 22.8918564, longitude: 87.99838779999999,
  },
  {
    name: "SHRI DURGA FLOUR MILL (Baganbati)",
    nameBn: "শ্রী দুর্গা ফ্লাওয়ার মিল (বাগানবাটি)",
    nameHi: "श्री दुर्गा फ्लौर मिल (बागानबाटी)",
    address: "Baganbati, West Bengal, India",
    district: "Hooghly", state: "West Bengal", capacity: 7940,
    ownerContact: "9831168788",
    commodities: ["rice","potato","carrot","guava"],
    latitude: 22.8385486, longitude: 88.14621770000001,
  },
  {
    name: "Malabika Cold Storage Private Limited",
    nameBn: "মালবিকা কোল্ড স্টোরেজ প্রাইভেট লিমিটেড",
    nameHi: "मालविका कोल्ड स्टोरेज प्राइवेट लिमिटेड",
    address: "Shankarpur, West Bengal 721423, India",
    district: "Paschim Medinipur", state: "West Bengal", capacity: 6200,
    ownerContact: "9811166782",
    commodities: ["rice","beans","cashew"],
    latitude: 21.6491352, longitude: 87.5698638,
  },
  {
    name: "K.P.S. Agro Products",
    nameBn: "কে.পি.এস. অ্যাগ্রো প্রোডাক্টস",
    nameHi: "के.पी.एस. एग्रो प्रोडक्ट्स",
    address: "R257+HM3, Ayampahar Pur, West Bengal 712401, India",
    district: "Hooghly", state: "West Bengal", capacity: 3500,
    ownerContact: "9144400501",
    commodities: ["rice","potato","carrot","guava"],
    latitude: 22.8088949, longitude: 88.0141763,
  },
  {
    name: "KARIMA GREEN PRODUCER COMPANY LIMITED",
    nameBn: "করিমা গ্রিন প্রোডিউসার কোম্পানি লিমিটেড",
    nameHi: "करीमा ग्रीन प्रोड्यूसर कंपनी लिमिटेड",
    address: "Mahisha, West Bengal 731218, India",
    district: "Birbhum", state: "West Bengal", capacity: 1388,
    ownerContact: "9874603600",
    commodities: ["rice","maize"],
    latitude: 23.9700719, longitude: 87.8101417,
  },
  {
    name: "Central Warehouse Raninagar",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস রানিনগর",
    nameHi: "सेंट्रल वेयरहाउस रानीनगर",
    address: "GJXX+F8J, Raninagar, Jalpaiguri, West Bengal 735133, India",
    district: "Jalpaiguri", state: "West Bengal", capacity: 20000,
    ownerContact: "9868924092",
    commodities: ["rice","maize","tea","pineapple","orange"],
    latitude: 26.548711, longitude: 88.6482533,
  },
  {
    name: "Central Warehouse Sarul",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস সারুল",
    nameHi: "सेंट्रल वेयरहाउस सारुल",
    address: "Ura, West Bengal 713406, India",
    district: "Purba Bardhaman", state: "West Bengal", capacity: 28620,
    ownerContact: "9868924092",
    commodities: ["rice","potato","wheat","green chilli"],
    latitude: 23.3170776, longitude: 87.7233552,
  },
  {
    name: "Central Warehouse Import & Export",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস ইমপোর্ট অ্যান্ড এক্সপোর্ট",
    nameHi: "सेंट्रल वेयरहाउस इम्पोर्ट एंड एक्सपोर्ट",
    address: "Garden Reach Rd, Kolkata, West Bengal, India",
    district: "Kolkata", state: "West Bengal", capacity: 13585,
    ownerContact: "9868924092",
    commodities: ["rice","eggplant","coriander"],
    latitude: 22.5465208, longitude: 88.2938454,
  },
  {
    name: "Central Warehouse Belda",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস বেলদা",
    nameHi: "सेंट्रल वेयरहाउस बेलदा",
    address: "Belda, West Bengal, India",
    district: "Paschim Medinipur", state: "West Bengal", capacity: 4100,
    ownerContact: "9868924092",
    // Excel: rice, maize, tomato, cotton
    commodities: ["rice","maize","tomato","cotton"],
    latitude: 22.0758421, longitude: 87.3412438,
  },
  {
    name: "Central Warehouse C.K. Road",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস সি.কে. রোড",
    nameHi: "सेंट्रल वेयरहाउस सी.के. रोड",
    address: "Rangamati, Midnapore, West Bengal, India",
    district: "Paschim Medinipur", state: "West Bengal", capacity: 31600,
    ownerContact: "9868924092",
    // Excel: rice, maize, carrots, cashew, cotton
    commodities: ["rice","maize","carrots","cashew","cotton"],
    latitude: 22.4230948, longitude: 87.3003706,
  },
  {
    name: "Central Warehouse Kharagpur",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস খড়গপুর",
    nameHi: "सेंट्रल वेयरहाउस खड़गपुर",
    address: "87WC+RGJ, Malancha, Kharagpur, West Bengal 721301, India",
    district: "Paschim Medinipur", state: "West Bengal", capacity: 21500,
    ownerContact: "9868924092",
    commodities: ["rice","maize","beans","cashew","mango"],
    latitude: 22.3470846, longitude: 87.27127829999999,
  },
  {
    name: "Central Warehouse Coochbehar",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস কোচবিহার",
    nameHi: "सेंट्रल वेयरहाउस कूचबिहार",
    address: "Nripendra Narayan Rd, Cooch Behar, West Bengal 736101, India",
    district: "Cooch Behar", state: "West Bengal", capacity: 7534,
    ownerContact: "9868924092",
    commodities: ["rice","jute"],
    latitude: 26.3263147, longitude: 89.4512615,
  },
  {
    name: "Central Warehouse, Malda",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস মালদা",
    nameHi: "सेंट्रल वेयरहाउस मालदा",
    address: "NH 12, West Bengal, India",
    district: "Malda", state: "West Bengal", capacity: 18664,
    ownerContact: "9868924092",
    commodities: ["rice","maize","mango","litchi"],
    latitude: 23.7237726, longitude: 88.2935844,
  },
  {
    name: "CENTRAL WAREHOUSE BURDWAN I",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস বর্ধমান ১",
    nameHi: "सेंट्रल वेयरहाउस बर्धमान १",
    address: "CH43+MFQ, Grand Trunk Rd, Budbud, West Bengal 713403, India",
    district: "Purba Bardhaman", state: "West Bengal", capacity: 4742,
    ownerContact: "9868924092",
    commodities: ["rice","potato","wheat"],
    latitude: 23.4067, longitude: 87.5537478,
  },
  {
    name: "R.W.C. Dankuni",
    nameBn: "আর.ডব্লিউ.সি. দাঙ্কুনি",
    nameHi: "आर.डब्ल्यू.सी. दांकुनी",
    address: "South, M7HM+4G4, near Ramakrishna spotting club, Rabindranagar, Station Pally, Dankuni, West Bengal 712311, India",
    district: "Hooghly", state: "West Bengal", capacity: 9421,
    ownerContact: "9868924092",
    commodities: ["rice","cabbage","litchi","guava"],
    latitude: 22.677761, longitude: 88.2838262,
  },
  {
    name: "Central Warehouse Panihati",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস পানিহাটি",
    nameHi: "सेंट्रल वेयरहाउस पानीहाटी",
    address: "Panihati, West Bengal, India",
    district: "North 24 Parganas", state: "West Bengal", capacity: 34447,
    ownerContact: "9868924092",
    commodities: ["rice","beans","brinjal","potato"],
    latitude: 22.6939468, longitude: 88.4036649,
  },
  {
    name: "Central Warehouse Goara",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস গোয়ারা",
    nameHi: "सेंट्रल वेयरहाउस गोआरा",
    address: "Goara, West Bengal, India",
    district: "Hooghly", state: "West Bengal", capacity: 5000,
    ownerContact: "9868924092",
    commodities: ["rice","cabbage","litchi"],
    latitude: 23.0954536, longitude: 88.2193381,
  },
  {
    name: "Central Warehouse Taratala Road",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস তারাতলা রোড",
    nameHi: "सेंट्रल वेयरहाउस तारातला रोड",
    address: "Shankar Coils Private Limited, 2, Taratala Rd, Makalhati Mauza, Kolkata, West Bengal 700088, India",
    district: "Kolkata", state: "West Bengal", capacity: 341,
    ownerContact: "9868924092",
    commodities: ["rice","eggplant","coriander"],
    latitude: 22.5224261, longitude: 88.2910067,
  },
  {
    name: "Central Warehouse Bonhooghly",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস বনহুগলি",
    nameHi: "सेंट्रल वेयरहाउस बोनहुगली",
    address: "Bonhooghly Government Colony, Baranagar, West Bengal, India",
    district: "Kolkata", state: "West Bengal", capacity: 31110,
    ownerContact: "9868924092",
    commodities: ["rice","potato","tomato"],
    latitude: 22.649365, longitude: 88.3805094,
  },
  {
    name: "Central Warehouse Panchpara",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস পাঁচপাড়া",
    nameHi: "सेंट्रल वेयरहाउस पांचपाड़ा",
    address: "Satyen Bose Rd, Howrah, West Bengal, India",
    district: "Howrah", state: "West Bengal", capacity: 18120,
    ownerContact: "9868924092",
    commodities: ["rice","potato","tomato","beans"],
    latitude: 22.5642767, longitude: 88.2580721,
  },
  {
    name: "CENTRAL WAREHOUSE BERHAMPORE",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস বহরমপুর",
    nameHi: "सेंट्रल वेयरहाउस बेरहामपुर",
    address: "Hata Colony, Keshobnagar, Berhampore, West Bengal 742102, India",
    district: "Murshidabad", state: "West Bengal", capacity: 31600,
    ownerContact: "9868924092",
    // Excel: rice, potato, mango, litchi, cotton
    commodities: ["rice","potato","mango","litchi","cotton"],
    latitude: 24.1009637, longitude: 88.28233829999999,
  },
  {
    name: "Central Warehouse Matigara (Siliguri)",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস মাটিগাড়া (শিলিগুড়ি)",
    nameHi: "सेंट्रल वेयरहाउस माटीगाड़ा (सिलीगुड़ी)",
    address: "NH 31, Matigarahat, Matigara, West Bengal 734010, India",
    district: "Darjeeling", state: "West Bengal", capacity: 5000,
    ownerContact: "9868924092",
    commodities: ["maize","tea","orange"],
    latitude: 26.7230488, longitude: 88.38689869999999,
  },
  {
    name: "CENTRAL WAREHOUSE BISHNUPUR",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস বিষ্ণুপুর",
    nameHi: "सेंट्रल वेयरहाउस बिष्णुपुर",
    address: "Sunil Aloy, Jamuna andh colony, Kelemele, Bishnupur, West Bengal 722122, India",
    district: "Bankura", state: "West Bengal", capacity: 16000,
    ownerContact: "9868924092",
    // Excel: rice, mango, guava, cotton
    commodities: ["rice","mango","guava","cotton"],
    latitude: 23.0717833, longitude: 87.29502269999999,
  },
  {
    name: "CENTRAL WAREHOUSE DURGACHAK",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস দুর্গাচক",
    nameHi: "सेंट्रल वेयरहाउस दुर्गाचक",
    address: "Durgachak, Haldia, West Bengal 721602, India",
    district: "Purba Medinipur", state: "West Bengal", capacity: 32400,
    ownerContact: "9868924092",
    commodities: ["rice","maize","carrots","tomato"],
    latitude: 22.0758287, longitude: 88.1364591,
  },
  {
    name: "Central Warehouse Haldia",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস হলদিয়া",
    nameHi: "सेंट्रल वेयरहाउस हल्दिया",
    address: "453J+34X main Gate, Energy limited, Jhikur.khali, Haldia, West Bengal 721635, India",
    district: "Purba Medinipur", state: "West Bengal", capacity: 15000,
    ownerContact: "9868924092",
    commodities: ["rice","maize","tomato","coconut"],
    latitude: 22.1027124, longitude: 88.180398,
  },
  {
    name: "Central Warehouse Uluberia",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস উলুবেড়িয়া",
    nameHi: "सेंट्रल वेयरहाउस उलूबेरिया",
    address: "Uluberia Industrial Growth Center, 49, Birshibpur, Uluberia, Howrah, West Bengal 711303, India",
    district: "Howrah", state: "West Bengal", capacity: 37590,
    ownerContact: "9868924092",
    commodities: ["rice","cucumber","potato"],
    latitude: 22.4766413, longitude: 88.0527345,
  },
  {
    name: "B R GRAINS PVT LTD",
    nameBn: "বি আর গ্রেইন্স প্রাইভেট লিমিটেড",
    nameHi: "बी आर ग्रेन्स प्राइवेट लिमिटेड",
    address: "W85H+2HG, Gotu, West Bengal 712102, India",
    district: "Hooghly", state: "West Bengal", capacity: 2154,
    ownerContact: "9830010650",
    commodities: ["rice","potato"],
    latitude: 22.9075728, longitude: 88.32893849999999,
  },
  {
    name: "BALAJI AGRO PVT LTD",
    nameBn: "বালাজি অ্যাগ্রো প্রাইভেট লিমিটেড",
    nameHi: "बालाजी एग्रो प्राइवेट लिमिटेड",
    address: "Sarkarpool, Rampur, Santoshpur, Maheshtala, West Bengal, India",
    district: "Kolkata", state: "West Bengal", capacity: 41200,
    ownerContact: "8003893017",
    commodities: ["rice","pumpkin","potato"],
    latitude: 22.5160854, longitude: 88.28893649999999,
  },
  {
    name: "F P K Agro",
    nameBn: "এফ পি কে অ্যাগ্রো",
    nameHi: "एफ पी के एग्रो",
    address: "34, Canal S Rd, Tangra, Kolkata, West Bengal 700015, India",
    district: "Kolkata", state: "West Bengal", capacity: 18600,
    ownerContact: "9836621177",
    commodities: ["rice","coriander","potato"],
    latitude: 22.559594, longitude: 88.39542569999999,
  },
  {
    name: "M.B. Grains",
    nameBn: "এম.বি. গ্রেইন্স",
    nameHi: "एम.बी. ग्रेन्स",
    address: "Kolkata, West Bengal 700040, India",
    district: "Kolkata", state: "West Bengal", capacity: 7198,
    ownerContact: "9733027807",
    commodities: ["rice","potato","ladyfinger"],
    latitude: 22.4868527, longitude: 88.350944,
  },
  {
    name: "Maa Annapurna",
    nameBn: "মা অন্নপূর্ণা",
    nameHi: "मां अन्नपूर्णा",
    address: "200, Dakshindari Rd, Lahabagan, Sreebhumi, Lake Town, South Dumdum, West Bengal 700048, India",
    district: "Kolkata", state: "West Bengal", capacity: 5716,
    ownerContact: "9051506463",
    commodities: ["rice","potato","chilli"],
    latitude: 22.5996578, longitude: 88.4006764,
  },
  {
    name: "Maa Durga Warehouse",
    nameBn: "মা দুর্গা ওয়্যারহাউস",
    nameHi: "मां दुर्गा वेयरहाउस",
    address: "174, Jessore Rd, Nagerbazar, Kamardanga, Kolkata, West Bengal 700074, India",
    district: "Kolkata", state: "West Bengal", capacity: 6652,
    ownerContact: "9433869226",
    commodities: ["rice","potato","ladyfinger"],
    latitude: 22.621516, longitude: 88.41427999999999,
  },
  {
    name: "Baba Jatadhari Agro",
    nameBn: "বাবা জটাধারী অ্যাগ্রো",
    nameHi: "बाबा जटाधारी एग्रो",
    address: "55, Canal E Rd, Sector 1, Bagmari, Kolkata, West Bengal 700085, India",
    district: "Kolkata", state: "West Bengal", capacity: 9491,
    ownerContact: "9434988350",
    commodities: ["rice","cabbage","cauliflower"],
    latitude: 22.5666688, longitude: 88.38224869999999,
  },
  {
    name: "Hindustan Warehouse",
    nameBn: "হিন্দুস্তান ওয়্যারহাউস",
    nameHi: "हिंदुस्तान वेयरहाउस",
    address: "1, Hide Rd, Tikiapara, Garden Reach, Kolkata, West Bengal 700043, India",
    district: "Kolkata", state: "West Bengal", capacity: 6002,
    ownerContact: "9836823471",
    commodities: ["rice","brinjal"],
    latitude: 22.5371023, longitude: 88.3094823,
  },
  {
    name: "S.B. Dutta Enterprise",
    nameBn: "এস.বি. দত্ত এন্টারপ্রাইজ",
    nameHi: "एस.बी. दत्ता एंटरप्राइज",
    address: "1, Oil Installation Rd, Alipore Mint Colony, Alipore, Kolkata, West Bengal 700088, India",
    district: "Kolkata", state: "West Bengal", capacity: 7585,
    ownerContact: "9051408227",
    // Excel: rice, brinjal, cotton
    commodities: ["rice","brinjal","cotton"],
    latitude: 22.5226392, longitude: 88.3124125,
  },
  {
    name: "Central Warehousing Corporation",
    nameBn: "সেন্ট্রাল ওয়্যারহাউজিং কর্পোরেশন",
    nameHi: "सेंट्रल वेयरहाउसिंग कॉर्पोरेशन",
    address: "Digsui, West Bengal, India",
    district: "Hooghly", state: "West Bengal", capacity: 6500,
    ownerContact: "9868924092",
    commodities: ["rice","potato","guava"],
    latitude: 23.0256638, longitude: 88.37491969999999,
  },
  {
    name: "Jics Logistic Limited",
    nameBn: "জিক্স লজিস্টিক লিমিটেড",
    nameHi: "जिक्स लॉजिस्टिक लिमिटेड",
    address: "Sankrail Industrial Park, Poly Park, Dhulagori, Howrah, West Bengal 711313, India",
    district: "Howrah", state: "West Bengal", capacity: 2596,
    ownerContact: "9425953344",
    commodities: ["rice","potato"],
    latitude: 22.5623607, longitude: 88.1882911,
  },
  {
    name: "Central Warehouse Jotram",
    nameBn: "সেন্ট্রাল ওয়্যারহাউস জোত্রাম",
    nameHi: "सेंट्रल वेयरहाउस जोत्राम",
    address: "Jotram, West Bengal, India",
    district: "Purba Bardhaman", state: "West Bengal", capacity: 16683,
    ownerContact: "9868924092",
    // Excel: rice, potato, carrot, potato → deduplicated to rice, potato, carrot
    commodities: ["rice","potato","carrot"],
    latitude: 23.2229253, longitude: 87.9310291,
  },
];

async function seed() {
  console.log('🌱 Starting cold storage seed...\n');

  // ─── Step 1: Upsert all crops (including cotton) ───────────────────────────
  console.log('📦 Upserting crops...');
  for (const crop of ALL_CROPS) {
    await prisma.cropMaster.upsert({
      where: { id: crop.id },
      update: {},
      create: crop,
    });
  }
  console.log(`✅ ${ALL_CROPS.length} crops ready\n`);

  // ─── Step 2: Check if already seeded ──────────────────────────────────────
  const existing = await prisma.coldStorage.count();
  if (existing > 0) {
    console.log(`⚠️  Cold storage table already has ${existing} records.`);
    console.log('   To re-seed, first clear the tables:');
    console.log('   npx prisma db execute --stdin <<< "DELETE FROM \\"ColdStorageCrop\\"; DELETE FROM \\"ColdStorage\\";"');
    console.log('   Then run this script again.');
    await prisma.$disconnect();
    return;
  }

  // ─── Step 3: Create cold storages + crop links ─────────────────────────────
  console.log('🏭 Seeding cold storages...');
  let created = 0;
  let skipped = 0;

  for (const wh of WAREHOUSES) {
    const cropIds = [...new Set(
      wh.commodities
        .map(c => COMMODITY_MAP[c.toLowerCase().trim()])
        .filter(Boolean)
    )];

    if (cropIds.length === 0) {
      console.warn(`  ⚠️  No matching crops for: ${wh.name}`);
      skipped++;
      continue;
    }

    await prisma.coldStorage.create({
      data: {
        name: wh.name,
        nameBn: wh.nameBn,
        nameHi: wh.nameHi,
        registeredUnder: 'West Bengal State Warehousing Corporation',
        ownerContact: wh.ownerContact,
        latitude: wh.latitude,
        longitude: wh.longitude,
        address: wh.address,
        district: wh.district,
        state: wh.state,
        capacity: wh.capacity,
        isActive: true,
        storedCrops: {
          create: cropIds.map(cropId => ({ cropId }))
        }
      }
    });

    console.log(`  ✅ ${wh.name} (${cropIds.length} crops)`);
    created++;
  }

  console.log(`\n🎉 Done! Created ${created} cold storages, skipped ${skipped}`);
  await prisma.$disconnect();
}

seed().catch(e => {
  console.error('❌ Seed failed:', e);
  prisma.$disconnect();
  process.exit(1);
});