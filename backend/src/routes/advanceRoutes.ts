import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middlewares/auth';
import {
    createAdvance,
    addAdvanceAttachments,
    downloadAdvancePdf,
    findAdvanceBeneficiaries,
    exportAdvancesExcel,
    getAdvanceById,
    getAdvances,
    importAdvances,
    previewAdvanceImport,
    updateAdvanceStatus
} from '../controllers/advanceController';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const sanitizeName = (name: string) => name.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${sanitizeName(file.originalname)}`)
});

const attachmentUpload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024, files: 20 }
}).array('attachments', 20);

const excelUpload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        const name = file.originalname.toLowerCase();
        callback(null, name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xls'));
    }
}).single('file');

const uploadHandler = (upload: any) => (req: Request, res: Response, next: NextFunction) => upload(req, res, (error: any) => {
    if (!error) return next();
    return res.status(error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
        .json({ error: error instanceof multer.MulterError ? 'El archivo supera el tamaño permitido' : error.message || 'No se pudo procesar el archivo' });
});

const router = Router();
router.use(authMiddleware);

router.get('/', getAdvances);
router.get('/beneficiaries', findAdvanceBeneficiaries);
router.get('/export', exportAdvancesExcel);
router.post('/import/preview', uploadHandler(excelUpload), previewAdvanceImport);
router.post('/import', uploadHandler(excelUpload), importAdvances);
router.get('/:id/pdf', downloadAdvancePdf);
router.get('/:id', getAdvanceById);
router.post('/', uploadHandler(attachmentUpload), createAdvance);
router.post('/:id/attachments', uploadHandler(attachmentUpload), addAdvanceAttachments);
router.patch('/:id/status', updateAdvanceStatus);

export default router;
