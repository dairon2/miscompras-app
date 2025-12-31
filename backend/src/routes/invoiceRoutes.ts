import { Router } from 'express';
import { getInvoices, createInvoice, verifyInvoice, approveInvoice, payInvoice } from '../controllers/invoiceController';
import { authMiddleware } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';

// Multer config for PDFs
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

const router = Router();

router.get('/', authMiddleware, getInvoices);
router.post('/', authMiddleware, upload.single('file'), createInvoice);
router.patch('/:id/verify', authMiddleware, verifyInvoice);
router.patch('/:id/approve', authMiddleware, approveInvoice);
router.patch('/:id/pay', authMiddleware, payInvoice);

export default router;
