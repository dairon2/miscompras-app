
import express from 'express';
import { chatWithAI } from '../controllers/aiController';
import { authMiddleware } from '../middlewares/auth';

const router = express.Router();

// Protected route - only logged in users can chat
router.post('/chat', authMiddleware, chatWithAI);

export default router;
