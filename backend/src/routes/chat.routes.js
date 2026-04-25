const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth.middleware');
const { advisoryChat, getChatHistory, clearChatHistory } = require('../controllers/chat.controller');

// 🤖 Advisory Chat
router.post('/advisory', protect, advisoryChat);

// Chat History — GET to load, DELETE to clear on crop end
router.get('/history', protect, getChatHistory);
router.delete('/history', protect, clearChatHistory);

module.exports = router;