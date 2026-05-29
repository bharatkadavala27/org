import { Router } from 'express';
import Budget from '../models/Budget.js';
import Expense from '../models/Expense.js';
import Scheme from '../models/Scheme.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { round2, sumRupees, toPaise, toRupees } from '../lib/money.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

function parseYear(value) {
  const year = Number(value || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new HttpError(400, 'Enter a valid year.');
  }
  return year;
}

function parsePlannedAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, 'Planned amount must be 0 or more.');
  return round2(n);
}

async function ensureScheme(schemeId) {
  if (!schemeId) throw new HttpError(400, 'Please select a scheme.');
  const scheme = await Scheme.findById(schemeId);
  if (!scheme) throw new HttpError(400, 'Invalid scheme.');
  return scheme;
}

// GET /api/budgets?schemeId=&year=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { schemeId } = req.query;
    await ensureScheme(schemeId);
    const year = parseYear(req.query.year);

    const budgets = await Budget.find({ schemeId, year }).sort({ category: 1 }).lean();
    res.json(budgets.map(serializeBudget));
  })
);

// PUT /api/budgets - upsert one category/year planned amount.
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const { schemeId, year: rawYear, category, plannedAmount } = req.body || {};
    await ensureScheme(schemeId);
    const year = parseYear(rawYear);
    if (!category || !String(category).trim()) throw new HttpError(400, 'Category is required.');
    const cleanCategory = String(category).trim();
    const cleanPlanned = parsePlannedAmount(plannedAmount);

    const beforeDoc = await Budget.findOne({ schemeId, year, category: cleanCategory }).lean();
    const budget = await Budget.findOneAndUpdate(
      { schemeId, year, category: cleanCategory },
      { $set: { schemeId, year, category: cleanCategory, plannedAmount: cleanPlanned } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    await audit({
      req,
      action: beforeDoc ? 'budget.update' : 'budget.create',
      entityType: 'Budget',
      entityId: budget._id,
      before: beforeDoc ? { plannedAmount: beforeDoc.plannedAmount } : undefined,
      after: { schemeId: String(schemeId), year, category: cleanCategory, plannedAmount: cleanPlanned },
    });

    res.json(serializeBudget(budget));
  })
);

// GET /api/budgets/variance?schemeId=&year=
router.get(
  '/variance',
  asyncHandler(async (req, res) => {
    const { schemeId } = req.query;
    await ensureScheme(schemeId);
    const year = parseYear(req.query.year);

    const [budgets, expenses] = await Promise.all([
      Budget.find({ schemeId, year }).sort({ category: 1 }).lean(),
      Expense.find({ schemeId, year, status: 'approved' }).lean(),
    ]);

    const actualPaiseByCategory = new Map();
    for (const expense of expenses) {
      const key = expense.category;
      const totalPaise = toPaise(sumRupees([expense.amount, expense.taxAmount || 0]));
      actualPaiseByCategory.set(key, (actualPaiseByCategory.get(key) || 0) + totalPaise);
    }

    const budgetByCategory = new Map(budgets.map((budget) => [budget.category, budget]));
    const categories = new Set([...budgetByCategory.keys(), ...actualPaiseByCategory.keys()]);
    const rows = [...categories].sort((a, b) => a.localeCompare(b)).map((category) => {
      const budget = budgetByCategory.get(category);
      const plannedAmount = budget ? budget.plannedAmount : 0;
      const actualAmount = toRupees(actualPaiseByCategory.get(category) || 0);
      const variance = toRupees(toPaise(plannedAmount) - toPaise(actualAmount));
      return {
        category,
        plannedAmount,
        actualAmount,
        variance,
        status: variance < 0 ? 'over' : variance > 0 ? 'under' : 'even',
        budgetId: budget ? String(budget._id) : null,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.plannedPaise += toPaise(row.plannedAmount);
        acc.actualPaise += toPaise(row.actualAmount);
        return acc;
      },
      { plannedPaise: 0, actualPaise: 0 }
    );
    const plannedTotal = toRupees(totals.plannedPaise);
    const actualTotal = toRupees(totals.actualPaise);
    const varianceTotal = toRupees(totals.plannedPaise - totals.actualPaise);

    res.json({
      schemeId: String(schemeId),
      year,
      rows,
      totals: {
        plannedAmount: plannedTotal,
        actualAmount: actualTotal,
        variance: varianceTotal,
        status: varianceTotal < 0 ? 'over' : varianceTotal > 0 ? 'under' : 'even',
      },
    });
  })
);

function serializeBudget(budget) {
  return {
    id: String(budget._id),
    schemeId: String(budget.schemeId),
    year: budget.year,
    category: budget.category,
    plannedAmount: budget.plannedAmount,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
  };
}

export default router;
