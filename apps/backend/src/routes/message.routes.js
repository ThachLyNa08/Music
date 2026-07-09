const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/unread-count', messageController.getUnreadCount);
router.post('/share-song', messageController.shareSongToUser);
router.post('/share', messageController.shareEntityToUser);
router.get('/conversations', messageController.getConversations);
router.post('/conversations/direct', messageController.createDirectConversation);
router.get('/conversations/:id/pin', messageController.getConversationPin);
router.post('/conversations/:id/pin', messageController.pinMessage);
router.delete('/conversations/:id/pin', messageController.unpinMessage);
router.get('/conversations/:id/shared-media', messageController.getConversationSharedMedia);
router.get('/conversations/:id/search', messageController.searchMessages);
router.get('/conversations/:id/messages', messageController.getMessages);
router.post('/conversations/:id/messages', messageController.sendMessage);
router.delete('/conversations/:id/messages/:messageId', messageController.deleteMessage);
router.post('/conversations/:id/share-song', messageController.shareSongToConversation);
router.post('/conversations/:id/share', messageController.shareEntityToConversation);
router.post('/conversations/:id/read', messageController.markRead);

// Listen Together MVP
router.get('/conversations/:id/listen-session', messageController.getListenSession);
router.post('/conversations/:id/listen-session/start', messageController.startListenSession);
router.post('/conversations/:id/listen-session/join', messageController.joinListenSession);
router.post('/conversations/:id/listen-session/leave', messageController.leaveListenSession);
router.post('/conversations/:id/listen-session/end', messageController.endListenSession);
router.post('/:messageId/reactions', messageController.toggleReaction);
router.get('/users/search', messageController.searchUsers);

module.exports = router;
