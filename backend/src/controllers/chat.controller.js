const crypto = require("crypto");
const prisma = require('../config/prisma');

// ============================================
// HELPER: Get or create active chat session
// ============================================
const getOrCreateActiveSession = async (farmerId, locationId, chatType, cropName = null, sowingDate = null, pinnedMessage = null) => {
  // Look for an existing active session of this type for this farm
  const existing = await prisma.chatSession.findFirst({
    where: {
      farmerId,
      locationId,
      chatType,
      isActive: true,
      // For crop sessions, match the crop name too so different crops get different sessions
      ...(chatType === 'CROP' && cropName ? { cropName } : {})
    },
    orderBy: { updatedAt: 'desc' }
  });

  if (existing) return existing;

  // Create new session
  let title;
  if (chatType === 'CROP' && cropName) {
    const dateStr = sowingDate
      ? new Date(sowingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    title = `${cropName} - ${dateStr}`;
  } else {
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    title = `General Chat - ${dateStr}`;
  }

  return await prisma.chatSession.create({
    data: {
      farmerId,
      locationId,
      title,
      chatType,
      cropName: cropName || null,
      sowingDate: sowingDate ? new Date(sowingDate) : null,
      // ✅ Store the full pinned message so it can be restored per-session
      pinnedMessage: pinnedMessage || null,
      isActive: true
    }
  });
};

// ============================================
// POST /api/chat/advisory
// Save a user+bot message pair under a session
// ============================================
const advisoryChat = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const {
      message,
      botReply,
      language,
      chatType: rawChatType,
      cropName,
      sowingDate,
      pinnedMessage,
      sessionId: providedSessionId,
      isWelcomeMessage,   // ── FIX: flag sent by frontend for the welcome message save
    } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    // Get active location
    const activeLocation = await prisma.farmerLocation.findFirst({
      where: { farmerId, isActive: true }
    });

    if (!activeLocation) {
      return res.status(400).json({
        success: false,
        message: "Please set an active farm location before using the chat."
      });
    }

    const locationId = activeLocation.id;
    const chatType = rawChatType === 'CROP' ? 'CROP' : 'GENERAL';

    // Get or create session, passing pinnedMessage so it gets stored
    const session = await getOrCreateActiveSession(
      farmerId, locationId, chatType, cropName, sowingDate, pinnedMessage
    );

    // If session exists but pinnedMessage was not yet stored, update it now
    if (session && pinnedMessage && !session.pinnedMessage) {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { pinnedMessage }
      });
    }

    const langMap = { hi: 'HINDI', bn: 'BENGALI', en: 'ENGLISH' };
    const messageLanguage = langMap[language] || 'ENGLISH';

    // ── FIX: For welcome message saves, only save the bot reply — skip the
    // dummy '__welcome__' user message entirely so it never appears in history.
    if (isWelcomeMessage) {
      if (botReply) {
        await prisma.chatHistory.create({
          data: {
            farmerId,
            locationId,
            sessionId: session.id,
            messageText: botReply,
            messageLanguage,
            isFarmerMessage: false
          }
        });
      }

      await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() }
      });

      return res.status(200).json({
        success: true,
        sessionId: session.id,
        message: "Welcome message saved"
      });
    }

    // Normal exchange: save farmer message then bot reply
    await prisma.chatHistory.create({
      data: {
        farmerId,
        locationId,
        sessionId: session.id,
        messageText: message,
        messageLanguage,
        isFarmerMessage: true
      }
    });

    if (botReply) {
      await prisma.chatHistory.create({
        data: {
          farmerId,
          locationId,
          sessionId: session.id,
          messageText: botReply,
          messageLanguage,
          isFarmerMessage: false
        }
      });
    }

    // Touch updatedAt on session
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { updatedAt: new Date() }
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      message: "Messages saved"
    });

  } catch (error) {
    console.error("Chat Save Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET /api/chat/history?locationId=xxx&sessionId=xxx
// Get messages for a specific session
// ============================================
const getChatHistory = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const { locationId, sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, message: "sessionId is required" });
    }

    const history = await prisma.chatHistory.findMany({
      where: { farmerId, locationId, sessionId },
      orderBy: { timestamp: 'asc' }
    });

    // Also return the session's stored pinnedMessage so frontend can restore it
    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { pinnedMessage: true, cropName: true, sowingDate: true, chatType: true }
    });

    return res.status(200).json({
      success: true,
      data: history,
      session  // includes pinnedMessage for restoration
    });

  } catch (error) {
    console.error("Chat History Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET /api/chat/sessions?locationId=xxx
// Get all chat sessions for this farm, grouped by type
// ============================================
const getChatSessions = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const { locationId } = req.query;

    if (!locationId) {
      return res.status(400).json({ success: false, message: "locationId is required" });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { farmerId, locationId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    const cropSessions = sessions.filter(s => s.chatType === 'CROP');
    const generalSessions = sessions.filter(s => s.chatType === 'GENERAL');

    return res.status(200).json({
      success: true,
      data: { cropSessions, generalSessions }
    });

  } catch (error) {
    console.error("Get Sessions Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// POST /api/chat/sessions/new
// Archive current active session — new one created lazily on first message
// ============================================
const startNewSession = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const { locationId, chatType: rawChatType } = req.body;

    if (!locationId) {
      return res.status(400).json({ success: false, message: "locationId is required" });
    }

    const chatType = rawChatType === 'CROP' ? 'CROP' : 'GENERAL';

    await prisma.chatSession.updateMany({
      where: { farmerId, locationId, chatType, isActive: true },
      data: { isActive: false }
    });

    return res.status(200).json({
      success: true,
      session: null,
      message: "Ready for new chat"
    });

  } catch (error) {
    console.error("Start New Session Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// PATCH /api/chat/sessions/archive
// Archive active sessions of a given type for a farm
// Called when farmer ends a crop
// ============================================
const archiveSessions = async (req, res) => {
  try {
    const farmerId = req.farmer.id;
    const { locationId, chatType: rawChatType } = req.body;

    if (!locationId) {
      return res.status(400).json({ success: false, message: "locationId is required" });
    }

    const chatType = rawChatType === 'CROP' ? 'CROP' : 'GENERAL';

    await prisma.chatSession.updateMany({
      where: { farmerId, locationId, chatType, isActive: true },
      data: { isActive: false }
    });

    return res.status(200).json({ success: true, message: "Sessions archived" });

  } catch (error) {
    console.error("Archive Sessions Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  advisoryChat,
  getChatHistory,
  getChatSessions,
  startNewSession,
  archiveSessions
};