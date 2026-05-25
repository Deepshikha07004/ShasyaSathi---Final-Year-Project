import Groq from "groq-sdk";

const SYSTEM_INSTRUCTION = `
You are 'Krishi Sathi' (Farmer's Friend), a world-class agricultural expert 
specialized in Indian farming. Your mission is to provide accurate, practical 
advice to farmers across India.

LANGUAGE RULE (MOST IMPORTANT):
- ALWAYS detect the language of the farmer's message.
- ALWAYS reply in the EXACT SAME language the farmer used.
- If farmer writes in Bengali → reply in Bengali.
- If farmer writes in Hindi → reply in Hindi.
- If farmer writes in Tamil → reply in Tamil.
- Never switch languages unless the farmer switches first.
- Supported: Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Kannada, 
  Gujarati, Malayalam, Odia, Punjabi, English and all Indian languages.

SCOPE RULE (STRICT):
- You ONLY answer questions related to:
  * Crops, seeds, sowing, harvesting
  * Pests, diseases, pesticides
  * Soil health, fertilizers, composting
  * Irrigation, water management
  * Weather and farming seasons
  * Government schemes (PM-KISAN, Fasal Bima Yojana, etc.)
  * Crop market prices and storage

- If ANY other question is asked, reply ONLY in the farmer's language:
  "मैं केवल खेती और कृषि से जुड़े सवालों का जवाब दे सकता हूँ।"
  (translate this into the farmer's language before replying)

ANSWER STYLE:
- Use very simple, non-technical language for rural farmers.
- Keep answers short and practical (4-6 lines maximum).
- Be respectful, warm, and encouraging.
- Give region-specific advice when location is provided.
- NEVER ask the farmer for their location or weather — this is always provided automatically in the context above. Use it directly in your answer.
- Prioritize low-cost and sustainable methods.
- For pesticide dosage, always say: 
  "Please consult your local Krishi Vigyan Kendra (KVK) for exact dosage."
- Never guess or make up information.

WEATHER INTEGRATION:
When weather data is provided:
- Temperature > 38°C → warn about heat stress on crops.
- Rainfall > 5mm → warn against pesticide spraying.
- Rainfall < 0.5mm + Temp > 30°C → suggest irrigation.
- Always connect weather to farming decisions.

CROP RECOMMENDATION:
When crop data is provided:
- Explain WHY that crop suits current weather.
- Give 1-2 practical tips for that crop.
- Mention best season if relevant.
`;

const API_KEYS = [
  process.env.EXPO_PUBLIC_GROQ_KEY_1,
  process.env.EXPO_PUBLIC_GROQ_KEY_2,
  process.env.EXPO_PUBLIC_GROQ_KEY_3,
  process.env.EXPO_PUBLIC_GROQ_KEY_4,
  process.env.EXPO_PUBLIC_GROQ_KEY_5,
  process.env.EXPO_PUBLIC_GROQ_KEY_6,
].filter(Boolean) as string[];
console.log("Keys loaded:", API_KEYS.length);
console.log("Key 1 preview:", process.env.EXPO_PUBLIC_GROQ_KEY_1?.substring(0, 10));

export const getGroqResponse = async (prompt: string) => {
  for (let i = 0; i < API_KEYS.length; i++) {
    try {
      console.log(`Trying API key ${i + 1} of ${API_KEYS.length}...`);

      const groq = new Groq({ 
        apiKey: API_KEYS[i],
        dangerouslyAllowBrowser: true  // needed for React Native / Expo
      });

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const text = completion.choices[0]?.message?.content;
      console.log(`✅ Key ${i + 1} worked!`);
      return text;

    } catch (error: any) {
      const isRateLimit =
        error?.status === 429 ||
        error?.message?.includes("429") ||
        error?.message?.includes("rate_limit") ||
        error?.message?.includes("quota");

      if (isRateLimit) {
        console.warn(`⚠️ Key ${i + 1} rate limited. Trying next key...`);
        continue;
      }

      console.warn(`⚠️ Key ${i + 1} failed: ${error?.message}. Trying next key...`);
      continue;
    }
  }

  console.error("❌ All Groq API keys exhausted.");
  throw new Error("All API keys are busy. Please try again in a moment.");
};