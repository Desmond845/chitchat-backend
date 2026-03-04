// routes/messageRoutes.js
import express from 'express';
import { getAllMessages, deleteMessage, updateMessage ,getUserMessages} from '../controllers/messageController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.get('/', authenticate, getUserMessages);

router.delete('/:id', authenticate, deleteMessage);
router.patch("/:id", authenticate, updateMessage)
export default router;