import { verifyToken } from '../lib/jwt.js';
import User from '../models/User.js';
import { HttpError } from './errorHandler.js';

// Verifies JWT, attaches req.user = { id, role, name }. 401 on missing/invalid/expired.
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new HttpError(401, 'Session expired or invalid. Please log in again.');
    }

    // Re-check the user still exists and is active (handles disabled accounts).
    const user = await User.findById(payload.id);
    if (!user || user.status !== 'active') {
      throw new HttpError(401, 'Account is not active. Please log in again.');
    }

    req.user = { id: String(user._id), role: user.role, name: user.name };
    next();
  } catch (err) {
    next(err);
  }
}
