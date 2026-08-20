
import express from 'express';
import * as aiController from '../controllers/aiController';
import { authMiddleware } from '../middlewares/auth';
import { aiChatRateLimit, aiConfirmRateLimit } from '../middlewares/aiRateLimit';

const router = express.Router();

// Protected route - only logged in users can chat
router.post('/chat', authMiddleware, aiChatRateLimit, aiController.chatWithAI);
router.post('/confirm', authMiddleware, aiConfirmRateLimit, aiController.confirmAction);
router.post('/extract', authMiddleware, aiChatRateLimit, aiController.extractRequirement);

export default router;
