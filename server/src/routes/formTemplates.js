import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { audit } from '../middleware/audit.js';
import FormTemplate from '../models/FormTemplate.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const { schemeId } = req.query;
  if (!schemeId) throw new HttpError(400, 'schemeId is required');

  let query = { schemeId };
  if (req.user.role !== 'admin') {
    query.active = true;
  }

  const templates = await FormTemplate.find(query).sort({ version: -1 });
  res.json(templates);
}));

router.get('/active/:schemeId', asyncHandler(async (req, res) => {
  const { schemeId } = req.params;
  const template = await FormTemplate.findOne({ schemeId, active: true });
  if (!template) throw new HttpError(404, 'Active template not found for this scheme');
  res.json(template);
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { schemeId, fields } = req.body;
  if (!schemeId) throw new HttpError(400, 'schemeId is required');
  
  const existing = await FormTemplate.findOne({ schemeId, active: true });
  if (existing) {
    throw new HttpError(400, 'An active template already exists for this scheme. Use PUT to update.');
  }

  const template = await FormTemplate.create({
    schemeId,
    fields: fields || [],
    version: 1,
    active: true
  });

  await audit({
    req,
    action: 'CREATE_FORM_TEMPLATE',
    entityType: 'FormTemplate',
    entityId: template._id,
    after: template.toObject()
  });

  res.status(201).json(template);
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fields } = req.body;

  const oldTemplate = await FormTemplate.findById(id);
  if (!oldTemplate) throw new HttpError(404, 'Template not found');
  if (!oldTemplate.active) throw new HttpError(400, 'Can only update active template');

  // Deactivate old
  oldTemplate.active = false;
  await oldTemplate.save();

  // Create new version
  const newTemplate = await FormTemplate.create({
    schemeId: oldTemplate.schemeId,
    version: oldTemplate.version + 1,
    fields: fields || [],
    active: true
  });

  await audit({
    req,
    action: 'UPDATE_FORM_TEMPLATE',
    entityType: 'FormTemplate',
    entityId: newTemplate._id,
    before: oldTemplate.toObject(),
    after: newTemplate.toObject()
  });

  res.json(newTemplate);
}));

export default router;
