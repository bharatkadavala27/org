import { Router } from 'express';
import Expense from '../models/Expense.js';
import Scheme from '../models/Scheme.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { isValidAmount, round2, sumRupees, toPaise, toRupees } from '../lib/money.js';

const router = Router();
router.use(requireAuth);

function parseYear(value) {
  const year = Number(value || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, 'Enter a valid year.');
  }
  return year;
}

function parseNonNegativeMoney(value, label) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${label} must be 0 or more.`);
  return round2(n);
}

function computeTaxAmount(amount, taxAmount, gstRate) {
  if (taxAmount !== undefined && taxAmount !== null && taxAmount !== '') {
    return parseNonNegativeMoney(taxAmount, 'GST/tax amount');
  }
  if (gstRate !== undefined && gstRate !== null && gstRate !== '') {
    const rate = Number(gstRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new HttpError(400, 'GST/tax rate must be between 0 and 100.');
    }
    return toRupees(Math.round((toPaise(amount) * rate) / 100));
  }
  return 0;
}

function totalForExpense(expense) {
  return sumRupees([expense.amount, expense.taxAmount || 0]);
}

// GET /api/expenses - admin sees all; sub-admin sees only their submissions.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === 'subadmin') filter.submittedBy = req.user.id;
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.schemeId) filter.schemeId = req.query.schemeId;
    if (req.query.category) filter.category = String(req.query.category).trim();
    if (req.query.year) filter.year = parseYear(req.query.year);

    const expenses = await Expense.find(filter)
      .sort({ createdAt: -1 })
      .limit(500)
      .populate('schemeId', 'name')
      .populate('submittedBy', 'name role')
      .populate('approvedBy', 'name role')
      .lean();

    res.json(expenses.map(serialize));
  })
);

// POST /api/expenses - admin/sub-admin submits an expense with a required receipt.
router.post(
  '/',
  requireRole('admin', 'subadmin'),
  asyncHandler(async (req, res) => {
    const { schemeId, category, amount, vendor, receiptUrl, gstNumber, taxAmount, gstRate, year } = req.body || {};
    if (!schemeId) throw new HttpError(400, 'Please select a scheme.');
    if (!category || !String(category).trim()) throw new HttpError(400, 'Category is required.');
    if (!isValidAmount(amount)) throw new HttpError(400, 'Amount must be greater than 0.');
    if (!receiptUrl || !String(receiptUrl).trim()) throw new HttpError(400, 'Receipt is required.');

    const scheme = await Scheme.findById(schemeId);
    if (!scheme) throw new HttpError(400, 'Invalid scheme.');

    const cleanAmount = round2(amount);
    const cleanTaxAmount = computeTaxAmount(cleanAmount, taxAmount, gstRate);

    const expense = await Expense.create({
      schemeId,
      year: parseYear(year),
      category: String(category).trim(),
      amount: cleanAmount,
      vendor: vendor ? String(vendor).trim() : undefined,
      receiptUrl: String(receiptUrl).trim(),
      gstNumber: gstNumber ? String(gstNumber).trim() : undefined,
      taxAmount: cleanTaxAmount,
      status: 'submitted',
      submittedBy: req.user.id,
    });

    await audit({
      req,
      action: 'expense.submit',
      entityType: 'Expense',
      entityId: expense._id,
      after: {
        schemeId: String(schemeId),
        year: expense.year,
        category: expense.category,
        amount: expense.amount,
        taxAmount: expense.taxAmount || 0,
        totalAmount: totalForExpense(expense),
        hasReceipt: true,
      },
    });

    const populated = await Expense.findById(expense._id)
      .populate('schemeId', 'name')
      .populate('submittedBy', 'name role')
      .populate('approvedBy', 'name role')
      .lean();

    res.status(201).json(serialize(populated));
  })
);

// PATCH /api/expenses/:id/approve - admin approval only.
router.patch(
  '/:id/approve',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const expense = await Expense.findById(req.params.id);
    if (!expense) throw new HttpError(404, 'Expense not found.');
    if (expense.status === 'approved') throw new HttpError(400, 'Expense is already approved.');

    const before = { status: expense.status, rejectReason: expense.rejectReason };
    expense.status = 'approved';
    expense.rejectReason = undefined;
    expense.approvedBy = req.user.id;
    await expense.save();

    await audit({
      req,
      action: 'expense.approve',
      entityType: 'Expense',
      entityId: expense._id,
      before,
      after: { status: expense.status, approvedBy: req.user.id, totalAmount: totalForExpense(expense) },
    });

    const populated = await Expense.findById(expense._id)
      .populate('schemeId', 'name')
      .populate('submittedBy', 'name role')
      .populate('approvedBy', 'name role')
      .lean();

    res.json(serialize(populated));
  })
);

// PATCH /api/expenses/:id/reject - admin rejection only, with a reason.
router.patch(
  '/:id/reject',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { reason } = req.body || {};
    if (!reason || !String(reason).trim()) throw new HttpError(400, 'A rejection reason is required.');

    const expense = await Expense.findById(req.params.id);
    if (!expense) throw new HttpError(404, 'Expense not found.');
    if (expense.status === 'rejected') throw new HttpError(400, 'Expense is already rejected.');

    const before = { status: expense.status, rejectReason: expense.rejectReason };
    expense.status = 'rejected';
    expense.rejectReason = String(reason).trim();
    expense.approvedBy = req.user.id;
    await expense.save();

    await audit({
      req,
      action: 'expense.reject',
      entityType: 'Expense',
      entityId: expense._id,
      before,
      after: { status: expense.status, reason: expense.rejectReason },
    });

    const populated = await Expense.findById(expense._id)
      .populate('schemeId', 'name')
      .populate('submittedBy', 'name role')
      .populate('approvedBy', 'name role')
      .lean();

    res.json(serialize(populated));
  })
);

function serialize(expense) {
  return {
    id: String(expense._id),
    scheme: expense.schemeId && expense.schemeId.name
      ? { id: String(expense.schemeId._id), name: expense.schemeId.name }
      : String(expense.schemeId),
    year: expense.year,
    category: expense.category,
    amount: expense.amount,
    taxAmount: expense.taxAmount || 0,
    totalAmount: totalForExpense(expense),
    vendor: expense.vendor,
    receiptUrl: expense.receiptUrl,
    gstNumber: expense.gstNumber,
    status: expense.status,
    rejectReason: expense.rejectReason,
    submittedBy: expense.submittedBy && expense.submittedBy.name
      ? { id: String(expense.submittedBy._id), name: expense.submittedBy.name, role: expense.submittedBy.role }
      : String(expense.submittedBy),
    approvedBy: expense.approvedBy && expense.approvedBy.name
      ? { id: String(expense.approvedBy._id), name: expense.approvedBy.name, role: expense.approvedBy.role }
      : expense.approvedBy ? String(expense.approvedBy) : null,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

export default router;
