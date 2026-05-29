import { Router } from 'express';
import Scheme from '../models/Scheme.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Public: active schemes (needed by the public donation page).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const schemes = await Scheme.find({ active: true }).sort({ createdAt: 1 }).lean();
    res.json(schemes.map((s) => ({ id: String(s._id), name: s.name, type: s.type })));
  })
);

export default router;
