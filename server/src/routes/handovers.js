import { Router } from 'express';
import mongoose from 'mongoose';
import Handover from '../models/Handover.js';
import Slip from '../models/Slip.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { sumRupees, round2 } from '../lib/money.js';

const router = Router();
router.use(requireAuth);

// POST /api/handovers — sub-admin submits a handover for selected slips
// { slipIds:[...], receivedTotal, note? }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { slipIds, receivedTotal, note } = req.body || {};
    if (!Array.isArray(slipIds) || slipIds.length === 0) {
      throw new HttpError(400, 'Select at least one slip.');
    }
    if (receivedTotal === undefined || receivedTotal === null || Number(receivedTotal) < 0) {
      throw new HttpError(400, 'Enter the received total.');
    }

    // Load slips by ObjectId or slipId to prevent CastErrors from stale clients.
    const validObjectIds = slipIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const slips = await Slip.find({
      $or: [{ _id: { $in: validObjectIds } }, { slipId: { $in: slipIds } }],
    });
    if (slips.length !== slipIds.length) throw new HttpError(400, 'Some slips were not found.');

    for (const s of slips) {
      if (req.user.role === 'subadmin' && String(s.collectedBy) !== req.user.id) {
        throw new HttpError(403, 'You can only hand over your own slips.');
      }
      if (s.status !== 'active') throw new HttpError(400, `Slip ${s.slipId} is void.`);
      if (s.inConfirmedHandover) {
        throw new HttpError(409, `Slip ${s.slipId} is already in a confirmed handover.`);
      }
      if (s.paymentMode !== 'cash') {
        throw new HttpError(400, `Slip ${s.slipId} is not cash; only cash is handed over.`);
      }
    }

    const expectedTotal = sumRupees(slips.map((s) => s.amount));
    const received = round2(receivedTotal);
    const variance = round2(received - expectedTotal);

    if (variance !== 0 && (!note || !String(note).trim())) {
      throw new HttpError(400, 'A note is required when the received total differs from expected.');
    }

    const handover = await Handover.create({
      subAdminId: req.user.id,
      slipIds: slips.map((s) => s._id),
      expectedTotal,
      receivedTotal: received,
      variance,
      status: 'submitted',
      note: note ? String(note).trim() : undefined,
    });

    await audit({
      req,
      action: 'handover.submit',
      entityType: 'Handover',
      entityId: handover._id,
      after: { expectedTotal, receivedTotal: received, variance, slips: slips.length },
    });

    res.status(201).json(serialize(handover));
  })
);

// GET /api/handovers — subadmin: own; admin: all (filter ?status=)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === 'subadmin') filter.subAdminId = req.user.id;
    if (req.query.status) filter.status = req.query.status;
    const handovers = await Handover.find(filter)
      .sort({ createdAt: -1 })
      .populate('subAdminId', 'name phone')
      .lean();
    res.json(handovers.map(serialize));
  })
);

// GET /api/handovers/:id — detail with slips
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const h = await Handover.findById(req.params.id).populate('subAdminId', 'name phone').lean();
    if (!h) throw new HttpError(404, 'Handover not found.');
    if (req.user.role === 'subadmin' && String(h.subAdminId._id) !== req.user.id) {
      throw new HttpError(403, 'Not your handover.');
    }
    const slips = await Slip.find({ _id: { $in: h.slipIds } }).populate('donorId', 'name village').lean();
    res.json({
      ...serialize(h),
      slips: slips.map((s) => ({
        id: String(s._id),
        slipId: s.slipId,
        amount: s.amount,
        donor: s.donorId ? s.donorId.name : s.isAnonymous ? 'Anonymous' : '—',
        status: s.status,
      })),
    });
  })
);

// PATCH /api/handovers/:id/confirm — admin confirms; LOCKS slips.
// Uses a transaction to prevent two handovers claiming the same slip.
router.patch(
  '/:id/confirm',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const h = await Handover.findById(req.params.id).session(session);
        if (!h) throw new HttpError(404, 'Handover not found.');
        if (h.status === 'confirmed') throw new HttpError(400, 'Already confirmed.');

        const slips = await Slip.find({ _id: { $in: h.slipIds } }).session(session);
        for (const s of slips) {
          if (s.inConfirmedHandover) {
            throw new HttpError(409, `Slip ${s.slipId} was locked by another handover. Refresh and retry.`);
          }
          if (s.status !== 'active') {
            throw new HttpError(409, `Slip ${s.slipId} is now void. Refresh the handover.`);
          }
        }

        await Slip.updateMany({ _id: { $in: h.slipIds } }, { $set: { inConfirmedHandover: true } }, { session });
        h.status = 'confirmed';
        h.confirmedBy = req.user.id;
        await h.save({ session });
        result = h;
      });

      await audit({
        req,
        action: 'handover.confirm',
        entityType: 'Handover',
        entityId: req.params.id,
        after: { status: 'confirmed' },
      });
      res.json(serialize(result));
    } finally {
      session.endSession();
    }
  })
);

// PATCH /api/handovers/:id/dispute — admin marks disputed (with note)
router.patch(
  '/:id/dispute',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { note } = req.body || {};
    if (!note || !String(note).trim()) throw new HttpError(400, 'A dispute note is required.');
    const h = await Handover.findById(req.params.id);
    if (!h) throw new HttpError(404, 'Handover not found.');
    if (h.status === 'confirmed') throw new HttpError(400, 'Cannot dispute a confirmed handover.');
    const before = { status: h.status };
    h.status = 'disputed';
    h.note = String(note).trim();
    await h.save();
    await audit({
      req,
      action: 'handover.dispute',
      entityType: 'Handover',
      entityId: h._id,
      before,
      after: { status: 'disputed', note: h.note },
    });
    res.json(serialize(h));
  })
);

function serialize(h) {
  return {
    id: String(h._id),
    subAdmin:
      h.subAdminId && h.subAdminId.name
        ? { id: String(h.subAdminId._id), name: h.subAdminId.name, phone: h.subAdminId.phone }
        : String(h.subAdminId),
    slipCount: Array.isArray(h.slipIds) ? h.slipIds.length : 0,
    expectedTotal: h.expectedTotal,
    receivedTotal: h.receivedTotal,
    variance: h.variance,
    status: h.status,
    note: h.note,
    createdAt: h.createdAt,
  };
}

export default router;
