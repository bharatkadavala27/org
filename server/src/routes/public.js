import express from 'express';
import Slip from '../models/Slip.js';
import Donor from '../models/Donor.js';
import Registration from '../models/Registration.js';
import Scheme from '../models/Scheme.js';

const router = express.Router();

// Simple in-memory cache for public stats (5 minutes)
let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_TTL = 5 * 60 * 1000;

// GET /api/public/stats
// Returns aggregated statistics for the homepage impact counter.
router.get('/stats', async (req, res, next) => {
  try {
    const now = Date.now();
    if (statsCache && (now - statsCacheTime < STATS_CACHE_TTL)) {
      return res.json(statsCache);
    }

    // 1. Total donation amount (active, confirmed slips)
    const amountAggr = await Slip.aggregate([
      { $match: { status: 'active', paymentConfirmed: true } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalAmount = amountAggr.length > 0 ? amountAggr[0].total : 0;

    // 2. Villages reached
    const villagesCount = await Donor.distinct('village').then(v => v.length);

    // 3. Couples Married (Verified registrations)
    const couplesCount = await Registration.countDocuments({ status: 'verified' });

    statsCache = {
      totalAmount,
      villagesReached: villagesCount,
      couplesMarried: couplesCount,
    };
    statsCacheTime = now;

    res.json(statsCache);
  } catch (err) {
    next(err);
  }
});

// GET /api/public/feed
// Returns the 15 most recent public donations for the live community feed
router.get('/feed', async (req, res, next) => {
  try {
    const recentSlips = await Slip.find({
      status: 'active',
      paymentConfirmed: true,
      isAnonymous: false,
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .populate('donorId', 'name village')
      .lean();

    const feed = recentSlips.map((slip) => ({
      _id: slip._id,
      amount: slip.amount,
      name: slip.donorId?.name || slip.donorName || 'Donor',
      village: slip.donorId?.village || slip.village || '',
      date: slip.createdAt,
    }));

    res.json(feed);
  } catch (err) {
    next(err);
  }
});

// GET /api/public/active-scheme
// Returns the currently active scheme to highlight on the homepage
router.get('/active-scheme', async (req, res, next) => {
  try {
    const activeScheme = await Scheme.findOne({ active: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(activeScheme || null);
  } catch (err) {
    next(err);
  }
});

export default router;
