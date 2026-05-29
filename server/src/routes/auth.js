import { Router } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../lib/jwt.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/login  { login, password }  (login = phone/identifier)
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { login, password } = req.body || {};
    if (!login || !password) {
      throw new HttpError(400, 'Phone/identifier and password are required.');
    }
    // Need the hash explicitly (select:false on the model).
    const user = await User.findOne({ phone: String(login).trim() }).select('+passwordHash');
    if (!user || user.status !== 'active') {
      throw new HttpError(401, 'Wrong credentials.');
    }
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) throw new HttpError(401, 'Wrong credentials.');

    const token = signToken({ id: String(user._id), role: user.role });
    res.json({
      token,
      user: { id: String(user._id), name: user.name, role: user.role, phone: user.phone },
    });
  })
);

// GET /api/auth/me  — verify token, return current user
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new HttpError(401, 'Account not found.');
    res.json({ user });
  })
);

export default router;
