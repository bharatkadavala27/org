import { Router } from 'express';
import Donor from '../models/Donor.js';
import Slip from '../models/Slip.js';
import Scheme from '../models/Scheme.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { nextSlipId } from '../lib/ids.js';
import { round2, isValidAmount } from '../lib/money.js';
import { importHash, normalizeName } from '../lib/normalize.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// System fields a column can map to.
const SYSTEM_FIELDS = ['name', 'fatherOrHusbandName', 'village', 'taluka', 'jilla', 'mobile', 'amount', 'year'];

// POST /api/import/validate
// { rows: [ { <systemField>: value, _row: <sourceRowIndex> } ], schemeId, year }
// Returns per-row validation + dedup suggestions. Does NOT write.
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const { rows, schemeId, year } = req.body || {};
    if (!Array.isArray(rows)) throw new HttpError(400, 'rows must be an array.');
    if (!schemeId) throw new HttpError(400, 'Select a scheme.');
    const scheme = await Scheme.findById(schemeId);
    if (!scheme) throw new HttpError(400, 'Invalid scheme.');

    const results = [];
    for (const r of rows) {
      const errors = [];
      const rowYear = Number(r.year || year);
      const name = (r.name || '').toString().trim();
      const amount = r.amount;

      if (!name) errors.push('Missing name');
      if (!isValidAmount(amount)) errors.push('Amount must be a number > 0');
      if (!rowYear || rowYear < 1900 || rowYear > 2200) errors.push('Invalid year');

      const hash = importHash({ name, village: r.village, amount, year: rowYear, sourceRow: r._row });
      const alreadyImported = await Slip.exists({ importHash: hash });

      // dedup suggestion (don't auto-merge): exact-ish donor match
      let dupDonor = null;
      if (name) {
        const candidate = await Donor.findOne({
          archived: false,
          mergedIntoId: null,
          name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
          ...(r.village ? { village: { $regex: `^${String(r.village).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } } : {}),
        }).lean();
        if (candidate) dupDonor = { id: String(candidate._id), name: candidate.name, village: candidate.village };
      }

      results.push({
        _row: r._row,
        name,
        amount,
        year: rowYear,
        village: r.village || '',
        errors,
        importHash: hash,
        alreadyImported: Boolean(alreadyImported),
        duplicateDonor: dupDonor,
      });
    }

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.errors.length === 0 && !r.alreadyImported).length,
      duplicates: results.filter((r) => r.alreadyImported).length,
      errors: results.filter((r) => r.errors.length > 0).length,
    };
    res.json({ summary, results, systemFields: SYSTEM_FIELDS });
  })
);

// POST /api/import/commit
// { rows: [...validated...], schemeId, year, useExistingDonor: true }
// Inserts in a batch; skips alreadyImported & error rows; idempotent via importHash.
router.post(
  '/commit',
  asyncHandler(async (req, res) => {
    const { rows, schemeId, year } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, 'No rows to import.');
    const scheme = await Scheme.findById(schemeId);
    if (!scheme) throw new HttpError(400, 'Invalid scheme.');

    let imported = 0;
    let skippedDup = 0;
    let skippedError = 0;
    const errorRows = [];

    for (const r of rows) {
      const rowYear = Number(r.year || year);
      const name = (r.name || '').toString().trim();
      const amount = r.amount;

      if (!name || !isValidAmount(amount) || !rowYear) {
        skippedError += 1;
        errorRows.push({ _row: r._row, name, amount, reason: 'validation' });
        continue;
      }

      const hash = importHash({ name, village: r.village, amount, year: rowYear, sourceRow: r._row });
      const exists = await Slip.exists({ importHash: hash });
      if (exists) {
        skippedDup += 1;
        continue;
      }

      // Reuse an existing donor if provided/found, else create one.
      let donorId = null;
      if (r.duplicateDonorId) {
        donorId = r.duplicateDonorId;
      } else {
        const donor = await Donor.create({
          name,
          fatherOrHusbandName: r.fatherOrHusbandName ? String(r.fatherOrHusbandName).trim() : '',
          village: r.village ? String(r.village).trim() : '',
          taluka: r.taluka ? String(r.taluka).trim() : '',
          jilla: r.jilla ? String(r.jilla).trim() : '',
          mobile: r.mobile ? String(r.mobile).trim() : undefined,
          importHash: hash,
        });
        donorId = donor._id;
      }

      const slipId = await nextSlipId(rowYear);
      await Slip.create({
        slipId,
        donorId,
        isAnonymous: false,
        schemeId,
        year: rowYear,
        amount: round2(amount),
        paymentMode: 'cash',
        paymentConfirmed: true, // historical, already collected
        collectedBy: req.user.id,
        status: 'active',
        issuedAt: new Date(rowYear, 0, 1),
        importHash: hash,
      });
      imported += 1;
    }

    await audit({
      req,
      action: 'import.commit',
      entityType: 'Slip',
      after: { imported, skippedDup, skippedError, scheme: scheme.name, year },
    });

    res.json({ imported, skippedDuplicates: skippedDup, skippedErrors: skippedError, errorRows });
  })
);

export default router;
