import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import VillageAssignment from '../models/VillageAssignment.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

// GET /api/users — list sub-admins (+ admins) with their villages
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    const assignments = await VillageAssignment.find().lean();
    const byUser = {};
    for (const a of assignments) {
      (byUser[String(a.userId)] ||= []).push({
        village: a.village,
        taluka: a.taluka,
        jilla: a.jilla,
      });
    }
    res.json(
      users.map((u) => ({
        id: String(u._id),
        name: u.name,
        phone: u.phone,
        role: u.role,
        status: u.status,
        villages: byUser[String(u._id)] || [],
      }))
    );
  })
);

// POST /api/users — create a sub-admin  { name, phone, password, villages:[{village,taluka,jilla}] }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, phone, password, villages = [] } = req.body || {};
    if (!name || !phone || !password) {
      throw new HttpError(400, 'Name, phone and password are required.');
    }
    if (String(password).length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters.');
    }
    const exists = await User.findOne({ phone: String(phone).trim() });
    if (exists) throw new HttpError(409, 'A user with this phone already exists.');

    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({
      name: String(name).trim(),
      phone: String(phone).trim(),
      passwordHash,
      role: 'subadmin',
      status: 'active',
    });

    const cleanVillages = (Array.isArray(villages) ? villages : [])
      .filter((v) => v && v.village)
      .map((v) => ({
        userId: user._id,
        village: String(v.village).trim(),
        taluka: v.taluka ? String(v.taluka).trim() : '',
        jilla: v.jilla ? String(v.jilla).trim() : '',
      }));
    if (cleanVillages.length) await VillageAssignment.insertMany(cleanVillages);

    await audit({
      req,
      action: 'user.create',
      entityType: 'User',
      entityId: user._id,
      after: { name: user.name, phone: user.phone, role: user.role, villages: cleanVillages.map((v) => v.village) },
    });

    res.status(201).json({ id: String(user._id), name: user.name, phone: user.phone, role: user.role });
  })
);

// PATCH /api/users/:id — enable/disable, reset password, replace villages
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found.');
    if (user.role === 'admin') throw new HttpError(400, 'Cannot modify the admin account here.');

    const before = { status: user.status };
    const { status, password, villages } = req.body || {};

    if (status && ['active', 'disabled'].includes(status)) user.status = status;
    if (password) {
      if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
      user.passwordHash = await bcrypt.hash(String(password), 10);
    }
    await user.save();

    if (Array.isArray(villages)) {
      await VillageAssignment.deleteMany({ userId: user._id });
      const clean = villages
        .filter((v) => v && v.village)
        .map((v) => ({
          userId: user._id,
          village: String(v.village).trim(),
          taluka: v.taluka ? String(v.taluka).trim() : '',
          jilla: v.jilla ? String(v.jilla).trim() : '',
        }));
      if (clean.length) await VillageAssignment.insertMany(clean);
    }

    await audit({
      req,
      action: 'user.update',
      entityType: 'User',
      entityId: user._id,
      before,
      after: { status: user.status, passwordChanged: Boolean(password) },
    });

    res.json({ id: String(user._id), status: user.status });
  })
);

export default router;
