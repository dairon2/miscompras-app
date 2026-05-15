import { Router } from 'express';
import { getInvoices, getInvoiceById, checkDuplicateInvoice, createInvoice, verifyInvoice, approveInvoice, payInvoice, deleteInvoice } from '../controllers/invoiceController';
import { authMiddleware } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Sanitize filename: remove accents/diacritics and replace spaces
const sanitizeFilename = (name: string): string => {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
};

// Multer config for PDFs
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

const router = Router();

router.get('/', authMiddleware, getInvoices);
router.get('/check-duplicate', authMiddleware, checkDuplicateInvoice);
router.get('/:id', authMiddleware, getInvoiceById);
router.post('/', authMiddleware, upload.single('file'), createInvoice);
router.patch('/:id/verify', authMiddleware, verifyInvoice);
router.patch('/:id/approve', authMiddleware, approveInvoice);
router.patch('/:id/pay', authMiddleware, payInvoice);
router.delete('/:id', authMiddleware, deleteInvoice);

export default router;
