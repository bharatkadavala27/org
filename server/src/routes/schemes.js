import { Router } from 'express';
import Scheme from '../models/Scheme.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { audit } from '../middleware/audit.js';

const router = Router();

// GET /api/schemes
// Returns ALL schemes if admin, or ONLY ACTIVE schemes if public/sub-admin
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // If we have an admin token, show all.
    // Since this route was originally public, we'll gracefully check req.user if it exists.
    // Express doesn't parse req.user unless requireAuth runs.
    // Let's explicitly check the Authorization header.
    const token = req.headers.authorization;
    let filter = { active: true };
    
    // If the client wants all schemes (for the admin page), they will pass a query param ?all=true
    if (req.query.all === 'true') {
      filter = {}; // Admin needs to see all schemes
    }

    const schemes = await Scheme.find(filter).sort({ createdAt: -1 }).lean();
    res.json(schemes.map((s) => ({ id: String(s._id), name: s.name, type: s.type, active: s.active, createdAt: s.createdAt })));
  })
);

// POST /api/schemes (Admin only)
router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, type, active } = req.body;
    if (!name) throw new HttpError(400, 'Scheme name is required');
    
    const scheme = await Scheme.create({ name, type: type || 'other', active: active !== false });
    
    await audit({
      req,
      action: 'CREATE_SCHEME',
      entityType: 'Scheme',
      entityId: scheme._id,
      after: scheme.toObject()
    });
    
    res.status(201).json({ id: String(scheme._id), name: scheme.name, type: scheme.type, active: scheme.active });
  })
);

// PUT /api/schemes/:id (Admin only)
router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { name, type, active } = req.body;
    const scheme = await Scheme.findById(req.params.id);
    if (!scheme) throw new HttpError(404, 'Scheme not found');
    
    const before = scheme.toObject();
    
    if (name !== undefined) scheme.name = name;
    if (type !== undefined) scheme.type = type;
    if (active !== undefined) scheme.active = active;
    
    await scheme.save();
    
    await audit({
      req,
      action: 'UPDATE_SCHEME',
      entityType: 'Scheme',
      entityId: scheme._id,
      before,
      after: scheme.toObject()
    });
    
    res.json({ id: String(scheme._id), name: scheme.name, type: scheme.type, active: scheme.active });
  })
);

export default router;
