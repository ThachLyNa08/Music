const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/unread-count', messageController.getUnreadCount);
router.post('/share-song', messageController.shareSongToUser);
router.get('/conversations', messageController.getConversations);
router.post('/conversations/direct', messageController.createDirectConversation);
router.get('/conversations/:id/messages', messageController.getMessages);
router.post('/conversations/:id/messages', messageController.sendMessage);
router.delete('/conversations/:id/messages/:messageId', messageController.deleteMessage);
router.post('/conversations/:id/share-song', messageController.shareSongToConversation);
router.post('/conversations/:id/read', messageController.markRead);
router.post('/:messageId/reactions', messageController.toggleReaction);
router.get('/users/search', messageController.searchUsers);

module.exports = router;
