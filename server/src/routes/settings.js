import { Router } from 'express';
import Setting from '../models/Setting.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { audit } from '../middleware/audit.js';

const router = Router();

const UPI_KEY = 'upi';
const BRANDING_KEY = 'branding';

const DEFAULT_BRANDING = {
  trustName: '',
  regNo: '',
  logoUrl: '',
  primaryColor: '#b91c1c',
  receiptFooter: '',
  whatsappTemplate: '',
};

function cleanOptionalUrl(value, label) {
  const s = value ? String(value).trim() : '';
  if (!s) return '';
  try {
    const url = new URL(s);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return s;
  } catch {
    throw new HttpError(400, `${label} must be a valid URL.`);
  }
}

function cleanColor(value) {
  const s = value ? String(value).trim() : DEFAULT_BRANDING.primaryColor;
  if (!/^#[0-9a-fA-F]{6}$/.test(s)) {
    throw new HttpError(400, 'Primary color must be a hex value like #b91c1c.');
  }
  return s;
}

// GET /api/settings/upi  — public (the donation page needs payee details)
router.get(
  '/upi',
  asyncHandler(async (_req, res) => {
    const doc = await Setting.findOne({ key: UPI_KEY }).lean();
    const value = doc?.value || {};
    res.json({
      payeeVpa: value.payeeVpa || '',
      payeeName: value.payeeName || '',
      upiNumber: value.upiNumber || '',
      defaultNote: value.defaultNote || '',
      qrImageUrl: value.qrImageUrl || '',
    });
  })
);

// PUT /api/settings/upi  — admin only
router.put(
  '/upi',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { payeeVpa, payeeName, upiNumber, defaultNote, qrImageUrl } = req.body || {};
    const cleanVpa = payeeVpa ? String(payeeVpa).trim() : '';
    const cleanName = payeeName ? String(payeeName).trim() : '';
    const cleanUpiNumber = upiNumber ? String(upiNumber).trim() : '';
    const cleanQrUrl = cleanOptionalUrl(qrImageUrl, 'QR image URL');
    if ((!cleanVpa || !cleanName) && !cleanQrUrl) {
      throw new HttpError(400, 'Enter UPI ID and payee name, or upload a QR image.');
    }
    if (cleanVpa && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(cleanVpa)) {
      throw new HttpError(400, 'UPI ID looks invalid (expected like name@bank).');
    }
    if (cleanVpa && !cleanName) {
      throw new HttpError(400, 'Payee name is required when UPI ID is set.');
    }
    const before = await Setting.findOne({ key: UPI_KEY }).lean();
    const value = {
      payeeVpa: cleanVpa,
      payeeName: cleanName,
      upiNumber: cleanUpiNumber,
      defaultNote: defaultNote ? String(defaultNote).trim() : '',
      qrImageUrl: cleanQrUrl,
    };
    const doc = await Setting.findOneAndUpdate(
      { key: UPI_KEY },
      { value },
      { upsert: true, new: true }
    );
    await audit({
      req,
      action: 'settings.upi.update',
      entityType: 'Setting',
      entityId: UPI_KEY,
      before: before?.value,
      after: value,
    });
    res.json(doc.value);
  })
);

// GET /api/settings/branding — public branding for header, receipts and shares.
router.get(
  '/branding',
  asyncHandler(async (_req, res) => {
    const doc = await Setting.findOne({ key: BRANDING_KEY }).lean();
    res.json({ ...DEFAULT_BRANDING, ...(doc?.value || {}) });
  })
);

// PUT /api/settings/branding — admin controls logo, receipt and share text.
router.put(
  '/branding',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { trustName, regNo, logoUrl, primaryColor, receiptFooter, whatsappTemplate } = req.body || {};
    const before = await Setting.findOne({ key: BRANDING_KEY }).lean();
    const value = {
      trustName: trustName ? String(trustName).trim() : '',
      regNo: regNo ? String(regNo).trim() : '',
      logoUrl: cleanOptionalUrl(logoUrl, 'Logo URL'),
      primaryColor: cleanColor(primaryColor),
      receiptFooter: receiptFooter ? String(receiptFooter).trim().slice(0, 500) : '',
      whatsappTemplate: whatsappTemplate ? String(whatsappTemplate).trim().slice(0, 700) : '',
    };
    const doc = await Setting.findOneAndUpdate(
      { key: BRANDING_KEY },
      { value },
      { upsert: true, new: true }
    );
    await audit({
      req,
      action: 'settings.branding.update',
      entityType: 'Setting',
      entityId: BRANDING_KEY,
      before: before?.value,
      after: value,
    });
    res.json(doc.value);
  })
);

export default router;
