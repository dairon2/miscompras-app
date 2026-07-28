import { NextFunction, Request, Response, Router } from 'express';
import { getInvoices, getInvoiceById, checkDuplicateInvoice, createInvoice, updateInvoice, verifyInvoice, approveInvoice, payInvoice, deleteInvoice, exportInvoicesExcel } from '../controllers/invoiceController';
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

const allowedAttachmentMimeTypes = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

// Multer config for invoice PDF and supporting attachments
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
        if (file.fieldname === 'file' && file.mimetype === 'application/pdf') {
            cb(null, true);
        } else if (file.fieldname === 'attachments' && allowedAttachmentMimeTypes.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido para facturas'));
        }
    }
});

const cleanupRejectedUploads = (req: Request) => {
    const uploaded = req.files;
    const files = Array.isArray(uploaded) ? uploaded : Object.values(uploaded || {}).flat();
    files.forEach(file => {
        if (!file?.path) return;
        try {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        } catch (cleanupError) {
            console.error('Could not clean rejected invoice upload:', cleanupError);
        }
    });
};

const uploadInvoiceFiles = (req: Request, res: Response, next: NextFunction) => {
    upload.fields([
        { name: 'file', maxCount: 1 },
        { name: 'attachments', maxCount: 10 }
    ])(req, res, (error: any) => {
        if (!error) return next();
        cleanupRejectedUploads(req);

        if (error instanceof multer.MulterError) {
            const status = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' ? 413 : 400;
            return res.status(status).json({
                error: error.code === 'LIMIT_FILE_SIZE'
                    ? 'Cada archivo de factura debe pesar máximo 10 MB'
                    : error.code === 'LIMIT_FILE_COUNT'
                        ? 'Puedes adjuntar máximo 10 anexos'
                        : 'No se pudieron procesar los archivos de la factura'
            });
        }

        return res.status(400).json({ error: error.message || 'Tipo de archivo no permitido para facturas' });
    });
};

const router = Router();

router.get('/', authMiddleware, getInvoices);
router.get('/export', authMiddleware, exportInvoicesExcel);
router.get('/check-duplicate', authMiddleware, checkDuplicateInvoice);
router.get('/:id', authMiddleware, getInvoiceById);
router.post('/', authMiddleware, uploadInvoiceFiles, createInvoice);
router.patch('/:id', authMiddleware, updateInvoice);
router.patch('/:id/verify', authMiddleware, verifyInvoice);
router.patch('/:id/approve', authMiddleware, approveInvoice);
router.patch('/:id/pay', authMiddleware, payInvoice);
router.delete('/:id', authMiddleware, deleteInvoice);

export default router;
