import { Router } from 'express';
import mongoose from 'mongoose';
import Donor from '../models/Donor.js';
import Slip from '../models/Slip.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';
import { normalizeName } from '../lib/normalize.js';
import { sumRupees, toPaise, toRupees } from '../lib/money.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const GUJARATI_NUKTA = /\u0ABC/g;
const NON_WORD_GUJARATI = /[^\p{L}\p{N}]+/gu;

function canonical(value) {
  return normalizeName(String(value || '').normalize('NFKC'))
    .replace(ZERO_WIDTH, '')
    .replace(GUJARATI_NUKTA, '')
    .replace(NON_WORD_GUJARATI, '');
}

function canonicalMobile(value) {
  return String(value || '').replace(/\D/g, '').slice(-10);
}

function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

function donorKey(donor) {
  return {
    name: canonical(donor.name),
    father: canonical(donor.fatherOrHusbandName),
    village: canonical(donor.village),
    mobile: canonicalMobile(donor.mobile),
  };
}

function scorePair(a, b) {
  const ka = donorKey(a);
  const kb = donorKey(b);
  const nameScore = similarity(ka.name, kb.name);
  const fatherScore = similarity(ka.father, kb.father);
  const villageScore = similarity(ka.village, kb.village);
  const mobileExact = ka.mobile && kb.mobile && ka.mobile === kb.mobile;
  const mobileConflict = ka.mobile && kb.mobile && ka.mobile !== kb.mobile;

  let score = 0;
  const reasons = [];

  if (ka.name && kb.name && nameScore === 1) {
    score += 35;
    reasons.push('same normalized name');
  } else if (nameScore >= 0.88) {
    score += 28;
    reasons.push('similar normalized name');
  }

  if (ka.father && kb.father && fatherScore === 1) {
    score += 25;
    reasons.push('same normalized father/husband name');
  } else if (ka.father && kb.father && fatherScore >= 0.88) {
    score += 18;
    reasons.push('similar father/husband name');
  } else if (!ka.father || !kb.father) {
    score += 10;
    reasons.push('missing father/husband name on one donor');
  }

  if (ka.village && kb.village && villageScore === 1) {
    score += 25;
    reasons.push('same normalized village');
  } else if (ka.village && kb.village && villageScore >= 0.9) {
    score += 18;
    reasons.push('similar normalized village');
  }

  if (mobileExact) {
    score += 15;
    reasons.push('same mobile');
  } else if (mobileConflict) {
    score -= 20;
    reasons.push('different mobile');
  }

  const requiredMatch = nameScore >= 0.88 && villageScore >= 0.9;
  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
    requiredMatch,
  };
}

class UnionFind {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(id) {
    const parent = this.parent.get(id);
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

async function statsForDonors(donorIds, session) {
  const slips = await Slip.find({ donorId: { $in: donorIds }, status: 'active' })
    .select('donorId amount')
    .session(session || null)
    .lean();
  const byDonor = new Map(donorIds.map((id) => [String(id), { slipCount: 0, lifetimeTotal: 0 }]));
  for (const slip of slips) {
    const key = String(slip.donorId);
    const current = byDonor.get(key) || { slipCount: 0, lifetimeTotal: 0 };
    current.slipCount += 1;
    current.lifetimeTotal = sumRupees([current.lifetimeTotal, slip.amount]);
    byDonor.set(key, current);
  }
  return byDonor;
}

async function allSlipCounts(donorIds, session) {
  const rows = await Slip.aggregate([
    { $match: { donorId: { $in: donorIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: '$donorId', count: { $sum: 1 } } },
  ]).session(session || null);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function serializeDonor(donor, stats, allCounts) {
  const id = String(donor._id);
  return {
    id,
    name: donor.name,
    fatherOrHusbandName: donor.fatherOrHusbandName || '',
    village: donor.village || '',
    taluka: donor.taluka || '',
    jilla: donor.jilla || '',
    mobile: donor.mobile || '',
    mergedIntoId: donor.mergedIntoId ? String(donor.mergedIntoId) : null,
    slipCount: stats.get(id)?.slipCount || 0,
    allSlipCount: allCounts.get(id) || 0,
    lifetimeTotal: stats.get(id)?.lifetimeTotal || 0,
  };
}

// GET /api/donor-merge/suggestions - never merges, only suggests possible duplicates.
router.get(
  '/suggestions',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 1000, 2000);
    const donors = await Donor.find({ archived: false, mergedIntoId: null })
      .sort({ village: 1, name: 1 })
      .limit(limit)
      .lean();

    const ids = donors.map((donor) => String(donor._id));
    const uf = new UnionFind(ids);
    const pairMeta = new Map();

    for (let i = 0; i < donors.length; i += 1) {
      for (let j = i + 1; j < donors.length; j += 1) {
        const pair = scorePair(donors[i], donors[j]);
        if (pair.requiredMatch && pair.score >= 70) {
          const a = String(donors[i]._id);
          const b = String(donors[j]._id);
          uf.union(a, b);
          pairMeta.set([a, b].sort().join('|'), pair);
        }
      }
    }

    const groups = new Map();
    for (const donor of donors) {
      const root = uf.find(String(donor._id));
      (groups.get(root) || groups.set(root, []).get(root)).push(donor);
    }

    const candidateGroups = [...groups.values()].filter((group) => group.length > 1);
    const donorIds = candidateGroups.flat().map((donor) => String(donor._id));
    const [stats, allCounts] = await Promise.all([statsForDonors(donorIds), allSlipCounts(donorIds)]);

    const suggestions = candidateGroups
      .map((group) => {
        const serialized = group.map((donor) => serializeDonor(donor, stats, allCounts));
        let confidence = 0;
        const reasons = new Set();
        for (let i = 0; i < group.length; i += 1) {
          for (let j = i + 1; j < group.length; j += 1) {
            const key = [String(group[i]._id), String(group[j]._id)].sort().join('|');
            const meta = pairMeta.get(key);
            if (meta) {
              confidence = Math.max(confidence, meta.score);
              meta.reasons.forEach((reason) => reasons.add(reason));
            }
          }
        }
        const combinedTotal = sumRupees(serialized.map((donor) => donor.lifetimeTotal));
        const totalSlipCount = serialized.reduce((acc, donor) => acc + donor.slipCount, 0);
        const totalReattachCount = serialized.reduce((acc, donor) => acc + donor.allSlipCount, 0);
        return {
          id: serialized.map((donor) => donor.id).sort().join('-'),
          confidence,
          reasons: [...reasons],
          donors: serialized,
          combinedTotal,
          totalSlipCount,
          totalReattachCount,
        };
      })
      .sort((a, b) => b.confidence - a.confidence || b.combinedTotal - a.combinedTotal);

    res.json(suggestions);
  })
);

// POST /api/donor-merge/merge - explicit merge after admin confirmation.
router.post(
  '/merge',
  asyncHandler(async (req, res) => {
    const { primaryDonorId, loserDonorIds } = req.body || {};
    if (!primaryDonorId || !mongoose.Types.ObjectId.isValid(primaryDonorId)) {
      throw new HttpError(400, 'Select a valid primary donor.');
    }
    if (!Array.isArray(loserDonorIds) || loserDonorIds.length === 0) {
      throw new HttpError(400, 'Select at least one donor to merge into the primary.');
    }
    const loserIds = [...new Set(loserDonorIds.map((id) => String(id)))];
    if (loserIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new HttpError(400, 'One or more merge donor IDs are invalid.');
    }
    if (loserIds.includes(String(primaryDonorId))) {
      throw new HttpError(400, 'Primary donor cannot also be merged as a duplicate.');
    }

    const allIds = [String(primaryDonorId), ...loserIds];
    const donors = await Donor.find({ _id: { $in: allIds } }).lean();
    if (donors.length !== allIds.length) throw new HttpError(404, 'One or more donors were not found.');
    const primary = donors.find((donor) => String(donor._id) === String(primaryDonorId));
    const losers = donors.filter((donor) => loserIds.includes(String(donor._id)));
    if (primary.mergedIntoId) throw new HttpError(400, 'The selected primary donor is already merged into another donor.');
    if (losers.some((donor) => donor.mergedIntoId)) {
      throw new HttpError(400, 'One or more selected duplicate donors are already merged.');
    }

    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const beforeStats = await statsForDonors(allIds, session);
        const beforeTotal = sumRupees(allIds.map((id) => beforeStats.get(id)?.lifetimeTotal || 0));
        const beforeAllCounts = await allSlipCounts(allIds, session);
        const reattachCount = loserIds.reduce((acc, id) => acc + (beforeAllCounts.get(id) || 0), 0);

        await Slip.updateMany(
          { donorId: { $in: loserIds } },
          { $set: { donorId: primaryDonorId } },
          { session }
        );
        await Donor.updateMany(
          { _id: { $in: loserIds } },
          { $set: { mergedIntoId: primaryDonorId } },
          { session }
        );

        const afterStats = await statsForDonors([primaryDonorId], session);
        const afterTotal = afterStats.get(String(primaryDonorId))?.lifetimeTotal || 0;
        if (toPaise(beforeTotal) !== toPaise(afterTotal)) {
          throw new HttpError(409, 'Merge total reconciliation failed. No donors were merged.');
        }

        result = {
          primaryDonorId: String(primaryDonorId),
          loserDonorIds: loserIds,
          beforeTotal: toRupees(toPaise(beforeTotal)),
          afterTotal: toRupees(toPaise(afterTotal)),
          balanced: true,
          reattachedSlipCount: reattachCount,
        };
      });
    } finally {
      session.endSession();
    }

    await audit({
      req,
      action: 'donor.merge',
      entityType: 'Donor',
      entityId: primaryDonorId,
      before: {
        primary: { id: String(primary._id), name: primary.name },
        losers: losers.map((donor) => ({ id: String(donor._id), name: donor.name })),
      },
      after: result,
    });

    res.json(result);
  })
);

export default router;
