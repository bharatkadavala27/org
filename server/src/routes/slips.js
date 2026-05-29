import { Router } from 'express';
import Slip from '../models/Slip.js';
import Donor from '../models/Donor.js';
import Scheme from '../models/Scheme.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, attachAssignedVillages } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { nextSlipId } from '../lib/ids.js';
import { isValidAmount, round2 } from '../lib/money.js';

const router = Router();
router.use(requireAuth);

// Helper: subadmin may only act on slips they collected.
function canTouchSlip(req, slip) {
  if (req.user.role === 'admin') return true;
  return slip.collectedBy && String(slip.collectedBy) === req.user.id;
}

// ---------------------------------------------------------------------------
// POST /api/slips  — sub-admin (or admin) issues a slip
// { donorName?, fatherOrHusbandName?, village, mobile?, existingDonorId?, isAnonymous,
//   schemeId, amount, paymentMode, bookNumber?, paymentRef? }
// ---------------------------------------------------------------------------
router.post(
  '/',
  attachAssignedVillages,
  asyncHandler(async (req, res) => {
    const {
      donorName,
      fatherOrHusbandName,
      village,
      mobile,
      existingDonorId,
      isAnonymous,
      schemeId,
      amount,
      paymentMode,
      bookNumber,
      paymentRef,
    } = req.body || {};

    if (!schemeId) throw new HttpError(400, 'Please select a scheme.');
    if (!isValidAmount(amount)) throw new HttpError(400, 'Amount must be greater than 0.');
    if (!['cash', 'upi', 'cheque'].includes(paymentMode)) {
      throw new HttpError(400, 'Invalid payment mode.');
    }
    const scheme = await Scheme.findById(schemeId);
    if (!scheme) throw new HttpError(400, 'Invalid scheme.');

    const anon = Boolean(isAnonymous);
    let donorId = null;
    let donorVillage = village ? String(village).trim() : '';

    if (!anon) {
      if (existingDonorId) {
        const existing = await Donor.findById(existingDonorId);
        if (!existing) throw new HttpError(400, 'Selected donor not found.');
        donorId = existing._id;
        donorVillage = existing.village || donorVillage;
      } else {
        if (!donorName || !String(donorName).trim()) {
          throw new HttpError(400, 'Donor name is required (or mark anonymous).');
        }
        if (!donorVillage) throw new HttpError(400, 'Village is required.');
      }
    }

    // Geography scope for sub-admins: the slip's village must be assigned.
    if (req.user.role === 'subadmin') {
      if (!donorVillage) throw new HttpError(400, 'Village is required.');
      if (!req.allowedVillages.includes(donorVillage)) {
        throw new HttpError(403, 'This village is not in your assigned area.');
      }
    }

    // Create donor if needed.
    if (!anon && !donorId) {
      const donor = await Donor.create({
        name: String(donorName).trim(),
        fatherOrHusbandName: fatherOrHusbandName ? String(fatherOrHusbandName).trim() : '',
        village: donorVillage,
        mobile: mobile ? String(mobile).trim() : undefined,
      });
      donorId = donor._id;
      await audit({ req, action: 'donor.create', entityType: 'Donor', entityId: donor._id, after: { name: donor.name, village: donor.village } });
    }

    const year = new Date().getFullYear();
    const slipId = await nextSlipId(year);
    const slip = await Slip.create({
      slipId,
      bookNumber: bookNumber ? String(bookNumber).trim() : undefined,
      donorId,
      isAnonymous: anon,
      schemeId,
      year,
      amount: round2(amount),
      paymentMode,
      paymentRef: paymentRef ? String(paymentRef).trim() : undefined,
      // cash is inherently confirmed at point of collection; upi/cheque need confirmation
      paymentConfirmed: paymentMode === 'cash',
      collectedBy: req.user.id,
      status: 'active',
      issuedAt: new Date(),
    });

    await audit({
      req,
      action: 'slip.create',
      entityType: 'Slip',
      entityId: slip._id,
      after: { slipId: slip.slipId, amount: slip.amount, paymentMode, village: donorVillage },
    });

    const populated = await Slip.findById(slip._id).populate('donorId', 'name village mobile').populate('schemeId', 'name').lean();
    res.status(201).json(serialize(populated));
  })
);

// ---------------------------------------------------------------------------
// GET /api/slips  — list. subadmin: only own; admin: all. Filters: status, paymentConfirmed, schemeId, year, unhandedOnly
// ---------------------------------------------------------------------------
router.get(
  '/',
  attachAssignedVillages,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === 'subadmin') filter.collectedBy = req.user.id;

    if (req.query.status) filter.status = req.query.status;
    if (req.query.schemeId) filter.schemeId = req.query.schemeId;
    if (req.query.year) filter.year = Number(req.query.year);
    if (req.query.paymentConfirmed === 'true') filter.paymentConfirmed = true;
    if (req.query.paymentConfirmed === 'false') filter.paymentConfirmed = false;
    // For handover building: active slips not yet locked in a confirmed handover.
    if (req.query.handoverEligible === 'true') {
      filter.status = 'active';
      filter.inConfirmedHandover = false;
      filter.paymentMode = 'cash';
    }

    const slips = await Slip.find(filter)
      .sort({ issuedAt: -1 })
      .limit(500)
      .populate('donorId', 'name village mobile')
      .populate('schemeId', 'name')
      .lean();
    res.json(slips.map(serialize));
  })
);

// ---------------------------------------------------------------------------
// GET /api/slips/:slipId — single (for receipt). Public-ish but requires auth here;
// public receipt is rendered client-side from the donate response.
// ---------------------------------------------------------------------------
router.get(
  '/:slipId',
  asyncHandler(async (req, res) => {
    const slip = await Slip.findOne({ slipId: req.params.slipId })
      .populate('donorId', 'name village mobile')
      .populate('schemeId', 'name')
      .lean();
    if (!slip) throw new HttpError(404, 'Slip not found.');
    if (req.user.role === 'subadmin' && String(slip.collectedBy) !== req.user.id) {
      throw new HttpError(403, 'Not your slip.');
    }
    res.json(serialize(slip));
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/slips/:slipId/confirm — admin confirms a UPI/cheque payment
// ---------------------------------------------------------------------------
router.patch(
  '/:slipId/confirm',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const slip = await Slip.findOne({ slipId: req.params.slipId, status: 'active' });
    if (!slip) throw new HttpError(404, 'Slip not found.');
    const before = { paymentConfirmed: slip.paymentConfirmed };
    slip.paymentConfirmed = true;
    await slip.save();
    await audit({
      req,
      action: 'slip.confirmPayment',
      entityType: 'Slip',
      entityId: slip._id,
      before,
      after: { paymentConfirmed: true },
    });
    res.json({ slipId: slip.slipId, paymentConfirmed: true });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/slips/:slipId/void — void with a reason (no hard delete)
// ---------------------------------------------------------------------------
router.patch(
  '/:slipId/void',
  asyncHandler(async (req, res) => {
    const slip = await Slip.findOne({ slipId: req.params.slipId });
    if (!slip) throw new HttpError(404, 'Slip not found.');
    if (!canTouchSlip(req, slip)) throw new HttpError(403, 'Not your slip.');
    if (slip.status === 'void') throw new HttpError(400, 'Slip already void.');

    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) throw new HttpError(400, 'A void reason is required.');

    const alreadyInConfirmed = slip.inConfirmedHandover;
    const before = { status: slip.status };
    slip.status = 'void';
    slip.voidReason = String(reason).trim();
    await slip.save();

    await audit({
      req,
      action: 'slip.void',
      entityType: 'Slip',
      entityId: slip._id,
      before,
      after: { status: 'void', reason: slip.voidReason, wasInConfirmedHandover: alreadyInConfirmed },
    });

    res.json({
      slipId: slip.slipId,
      status: slip.status,
      // flag so the UI can warn the office to reconcile a confirmed handover
      flaggedInConfirmedHandover: alreadyInConfirmed,
    });
  })
);

function serialize(s) {
  return {
    id: String(s._id),
    slipId: s.slipId,
    bookNumber: s.bookNumber,
    donor: s.donorId ? { id: String(s.donorId._id), name: s.donorId.name, village: s.donorId.village, mobile: s.donorId.mobile } : null,
    isAnonymous: s.isAnonymous,
    scheme: s.schemeId ? { id: String(s.schemeId._id), name: s.schemeId.name } : null,
    year: s.year,
    amount: s.amount,
    paymentMode: s.paymentMode,
    paymentRef: s.paymentRef,
    paymentConfirmed: s.paymentConfirmed,
    receiptUrl: s.receiptUrl,
    status: s.status,
    voidReason: s.voidReason,
    inConfirmedHandover: s.inConfirmedHandover,
    issuedAt: s.issuedAt,
  };
}

export default router;
