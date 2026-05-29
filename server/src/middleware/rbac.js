import VillageAssignment from '../models/VillageAssignment.js';
import { HttpError } from './errorHandler.js';

// Allow only the given roles.
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to perform this action.'));
    }
    next();
  };
}

/**
 * For sub-admins: attach req.allowedVillages (array of village names they are assigned to).
 * Admins get allowedVillages = null (meaning "all").
 * Routes then scope their queries with this.
 */
export async function attachAssignedVillages(req, _res, next) {
  try {
    if (!req.user) throw new HttpError(401, 'Authentication required');
    if (req.user.role === 'admin') {
      req.allowedVillages = null; // all
      return next();
    }
    const assignments = await VillageAssignment.find({ userId: req.user.id }).lean();
    req.allowedVillages = assignments.map((a) => a.village);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard a specific village value (e.g. on slip create). Admins pass.
 * Sub-admins must have the village in their assignments.
 */
export function requireAssignedVillage(getVillage) {
  return async (req, _res, next) => {
    try {
      if (req.user.role === 'admin') return next();
      const assignments = await VillageAssignment.find({ userId: req.user.id }).lean();
      const allowed = assignments.map((a) => a.village);
      const village = getVillage(req);
      if (!village || !allowed.includes(village)) {
        return next(
          new HttpError(403, 'This village is not in your assigned area.')
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
