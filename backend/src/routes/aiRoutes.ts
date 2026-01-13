
import express from 'express';
import * as aiController from '../controllers/aiController';
import { authMiddleware } from '../middlewares/auth';

const router = express.Router();

// Protected route - only logged in users can chat
router.post('/chat', authMiddleware, aiController.chatWithAI);
router.post('/extract', authMiddleware, aiController.extractRequirement);

export default router;
