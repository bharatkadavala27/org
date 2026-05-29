import { Router } from 'express';
import multer from 'multer';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { uploadBuffer, isCloudinaryConfigured } from '../lib/cloudinary.js';

const router = Router();

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new HttpError(400, 'Only JPG, PNG, WEBP or PDF files are allowed.'));
    }
    cb(null, true);
  },
});

// POST /api/uploads?folder=receipts  (multipart, field "file")
// Public so donors can upload payment screenshots; validated tightly.
router.post(
  '/',
  (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(400, 'File too large (max 5 MB).'));
        return next(err);
      }
      next();
    }),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded.');
    const folder = ['receipts', 'documents', 'photos', 'qr'].includes(String(req.query.folder))
      ? String(req.query.folder)
      : 'misc';

    if (!isCloudinaryConfigured()) {
      throw new HttpError(503, 'File storage is not configured. Add Cloudinary keys to enable uploads.');
    }
    const { url } = await uploadBuffer(req.file.buffer, folder);
    res.status(201).json({ url });
  })
);

export default router;
