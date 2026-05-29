import { Router } from 'express';
import AuditLog from '../models/AuditLog.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function buildFilter(q) {
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.action) filter.action = { $regex: String(q.action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  if (q.userId) filter.userId = q.userId;
  if (q.from || q.to) {
    filter.ts = {};
    if (q.from) filter.ts.$gte = new Date(q.from);
    if (q.to) filter.ts.$lte = new Date(q.to);
  }
  return filter;
}

// GET /api/audit  — filterable, paginated
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Number(req.query.limit) || 50);
    const [rows, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ ts: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name phone')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.json({
      total,
      page,
      limit,
      rows: rows.map((r) => ({
        id: String(r._id),
        ts: r.ts,
        user: r.userId ? r.userId.name : 'system/public',
        role: r.role,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before,
        after: r.after,
      })),
    });
  })
);

// GET /api/audit/export.csv — matches the same filters
router.get(
  '/export.csv',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query);
    const rows = await AuditLog.find(filter).sort({ ts: -1 }).limit(10000).populate('userId', 'name').lean();
    const header = ['ts', 'user', 'role', 'action', 'entityType', 'entityId'];
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [r.ts?.toISOString(), r.userId ? r.userId.name : 'system/public', r.role, r.action, r.entityType, r.entityId]
          .map(escape)
          .join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_log.csv"');
    res.send('﻿' + lines.join('\n')); // BOM for Excel + Gujarati
  })
);

export default router;
