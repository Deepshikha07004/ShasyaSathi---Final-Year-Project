const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');
const {
  advisoryChat,
  getChatHistory,
  getChatSessions,
  startNewSession,
  archiveSessions
} = require('../controllers/chat.controller');

// Save messages (user + bot) under a session
router.post('/advisory', protect, advisoryChat);

// Get messages for a specific session
router.get('/history', protect, getChatHistory);

// Get all sessions for a farm, grouped by type
router.get('/sessions', protect, getChatSessions);

// Archive current session and start a new one (called by "Start New Chat" button)
router.post('/sessions/new', protect, startNewSession);

// Archive active sessions of a given type (called when farmer ends a crop)
router.patch('/sessions/archive', protect, archiveSessions);

module.exports = router;