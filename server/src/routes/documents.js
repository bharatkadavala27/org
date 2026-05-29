import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { audit } from '../middleware/audit.js';
import Document from '../models/Document.js';
import Registration from '../models/Registration.js';
import FormTemplate from '../models/FormTemplate.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { registrationId } = req.query;
  const query = {};
  if (registrationId) query.registrationId = registrationId;
  const docs = await Document.find(query).sort({ version: -1 });
  res.json(docs);
}));

router.get('/expiring', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days || '30', 10);
  const now = new Date();
  const future = new Date();
  future.setDate(future.getDate() + days);

  const docs = await Document.find({
    expiryDate: { $gte: now, $lte: future }
  });
  res.json(docs);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { registrationId, type, fileUrl, expiryDate } = req.body;
  if (!registrationId || !type || !fileUrl) {
    throw new HttpError(400, 'registrationId, type, and fileUrl are required');
  }

  const doc = await Document.create({
    registrationId, type, fileUrl, expiryDate, status: 'pending', version: 1
  });

  await audit({
    req, action: 'UPLOAD_DOCUMENT', entityType: 'Document', entityId: doc._id, after: doc.toObject()
  });

  res.status(201).json(doc);
}));

router.patch('/:id/verify', asyncHandler(async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Document not found');

  const oldDoc = doc.toObject();
  doc.status = 'verified';
  doc.rejectReason = undefined;
  await doc.save();

  await audit({
    req, action: 'VERIFY_DOCUMENT', entityType: 'Document', entityId: doc._id, before: oldDoc, after: doc.toObject()
  });

  // Check if all required docs are verified
  const reg = await Registration.findById(doc.registrationId);
  if (reg && reg.status === 'submitted') {
    const template = await FormTemplate.findOne({ schemeId: reg.schemeId, version: reg.formTemplateVersion });
    if (template) {
      const requiredTypes = template.fields
        .filter(f => f.type === 'file' && f.required)
        .map(f => f.key);

      if (requiredTypes.length > 0) {
        const verifiedDocs = await Document.find({
          registrationId: reg._id,
          status: 'verified',
          type: { $in: requiredTypes }
        });

        const verifiedTypes = new Set(verifiedDocs.map(d => d.type));
        const allVerified = requiredTypes.every(t => verifiedTypes.has(t));

        if (allVerified) {
          const oldReg = reg.toObject();
          reg.status = 'verified';
          await reg.save();

          await audit({
            req, action: 'AUTO_VERIFY_REGISTRATION', entityType: 'Registration', entityId: reg._id, before: oldReg, after: reg.toObject()
          });
        }
      }
    }
  }

  res.json(doc);
}));

router.patch('/:id/reject', asyncHandler(async (req, res) => {
  const { rejectReason } = req.body;
  if (!rejectReason) throw new HttpError(400, 'rejectReason is required');

  const doc = await Document.findById(req.params.id);
  if (!doc) throw new HttpError(404, 'Document not found');

  const oldDoc = doc.toObject();
  doc.status = 'resubmit';
  doc.rejectReason = rejectReason;
  await doc.save();

  await audit({
    req, action: 'REJECT_DOCUMENT', entityType: 'Document', entityId: doc._id, before: oldDoc, after: doc.toObject()
  });

  res.json(doc);
}));

router.post('/:id/resubmit', asyncHandler(async (req, res) => {
  const { fileUrl, expiryDate } = req.body;
  const oldDoc = await Document.findById(req.params.id);
  if (!oldDoc) throw new HttpError(404, 'Document not found');
  if (oldDoc.status !== 'resubmit') throw new HttpError(400, 'Document must be in resubmit status');

  const newDoc = await Document.create({
    registrationId: oldDoc.registrationId,
    type: oldDoc.type,
    fileUrl: fileUrl || oldDoc.fileUrl,
    expiryDate: expiryDate !== undefined ? expiryDate : oldDoc.expiryDate,
    status: 'pending',
    version: oldDoc.version + 1
  });

  await audit({
    req, action: 'RESUBMIT_DOCUMENT', entityType: 'Document', entityId: newDoc._id, after: newDoc.toObject()
  });

  res.status(201).json(newDoc);
}));

export default router;
