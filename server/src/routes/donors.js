import { Router } from 'express';
import Donor from '../models/Donor.js';
import Slip from '../models/Slip.js';
import Scheme from '../models/Scheme.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, attachAssignedVillages } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { nextSlipId } from '../lib/ids.js';
import { isValidAmount, round2 } from '../lib/money.js';

const router = Router();

// ---------------------------------------------------------------------------
// PUBLIC: donor typeahead (to avoid duplicates). Min 2 chars.
// GET /api/donors/search?q=...
// ---------------------------------------------------------------------------
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    // Escape regex special chars in user input.
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const donors = await Donor.find({
      archived: false,
      mergedIntoId: null,
      name: { $regex: safe, $options: 'i' },
    })
      .limit(10)
      .lean();
    res.json(
      donors.map((d) => ({
        id: String(d._id),
        name: d.name,
        fatherOrHusbandName: d.fatherOrHusbandName,
        village: d.village,
        mobile: d.mobile,
      }))
    );
  })
);

// ---------------------------------------------------------------------------
// PUBLIC: create a donation (UPI, unconfirmed). No login.
// POST /api/donors/donate
// { name?, mobile?, village?, fatherOrHusbandName?, isAnonymous, existingDonorId?, schemeId, amount }
// ---------------------------------------------------------------------------
router.post(
  '/donate',
  // public rate limiter attached in app.js via app.locals; apply here:
  (req, res, next) => {
    const limiter = req.app.locals.publicDonationLimiter;
    return limiter ? limiter(req, res, next) : next();
  },
  asyncHandler(async (req, res) => {
    const {
      name,
      mobile,
      village,
      fatherOrHusbandName,
      isAnonymous,
      existingDonorId,
      schemeId,
      amount,
    } = req.body || {};

    if (!schemeId) throw new HttpError(400, 'Please select a scheme.');
    if (!isValidAmount(amount)) throw new HttpError(400, 'Amount must be a number greater than 0.');

    const scheme = await Scheme.findById(schemeId);
    if (!scheme || !scheme.active) throw new HttpError(400, 'Invalid scheme.');

    const anon = Boolean(isAnonymous);
    let donorId = null;

    if (!anon) {
      if (existingDonorId) {
        const existing = await Donor.findById(existingDonorId);
        if (!existing || existing.archived) throw new HttpError(400, 'Selected donor not found.');
        donorId = existing._id;
      } else {
        if (!name || !String(name).trim()) {
          throw new HttpError(400, 'Please enter your name or choose anonymous.');
        }
        const donor = await Donor.create({
          name: String(name).trim(),
          fatherOrHusbandName: fatherOrHusbandName ? String(fatherOrHusbandName).trim() : '',
          village: village ? String(village).trim() : '',
          mobile: mobile ? String(mobile).trim() : undefined,
        });
        donorId = donor._id;
        await audit({
          req,
          action: 'donor.create.public',
          entityType: 'Donor',
          entityId: donor._id,
          after: { name: donor.name, village: donor.village },
        });
      }
    }

    const year = new Date().getFullYear();
    const slipId = await nextSlipId(year);
    const slip = await Slip.create({
      slipId,
      donorId,
      isAnonymous: anon,
      schemeId,
      year,
      amount: round2(amount),
      paymentMode: 'upi',
      paymentConfirmed: false,
      collectedBy: null,
      status: 'active',
      issuedAt: new Date(),
    });

    await audit({
      req,
      action: 'slip.create.public',
      entityType: 'Slip',
      entityId: slip._id,
      after: { slipId: slip.slipId, amount: slip.amount, schemeId: String(schemeId), anon },
    });

    res.status(201).json({
      slipId: slip.slipId,
      id: String(slip._id),
      amount: slip.amount,
      paymentConfirmed: slip.paymentConfirmed,
      scheme: scheme.name,
    });
  })
);

// ---------------------------------------------------------------------------
// PUBLIC: attach a payment screenshot URL after "I've paid".
// PATCH /api/donors/donate/:slipId/paid   { receiptUrl?, paymentRef? }
// (the upload itself goes through /api/uploads which returns a URL)
// ---------------------------------------------------------------------------
router.patch(
  '/donate/:slipId/paid',
  asyncHandler(async (req, res) => {
    const slip = await Slip.findOne({ slipId: req.params.slipId, status: 'active' });
    if (!slip) throw new HttpError(404, 'Slip not found.');
    if (slip.paymentMode !== 'upi') throw new HttpError(400, 'Not a UPI slip.');

    const { receiptUrl, paymentRef } = req.body || {};
    if (receiptUrl) slip.receiptUrl = String(receiptUrl);
    if (paymentRef) slip.paymentRef = String(paymentRef).trim();
    // NOTE: we do NOT auto-confirm. Office confirms manually.
    await slip.save();

    await audit({
      req,
      action: 'slip.markedPaid.public',
      entityType: 'Slip',
      entityId: slip._id,
      after: { slipId: slip.slipId, hasReceipt: Boolean(slip.receiptUrl) },
    });

    res.json({ slipId: slip.slipId, paymentConfirmed: slip.paymentConfirmed });
  })
);

// ---------------------------------------------------------------------------
// AUTH below this line
// ---------------------------------------------------------------------------
router.use(requireAuth);

// GET /api/donors  — list (admin all; subadmin scoped to assigned villages)
router.get(
  '/',
  attachAssignedVillages,
  asyncHandler(async (req, res) => {
    const filter = { archived: false, mergedIntoId: null };
    if (req.allowedVillages) {
      // subadmin
      filter.village = { $in: req.allowedVillages };
    }
    const donors = await Donor.find(filter).sort({ name: 1 }).limit(500).lean();
    res.json(donors.map((d) => ({ ...d, id: String(d._id) })));
  })
);

export default router;
