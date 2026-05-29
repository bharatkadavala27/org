import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { audit } from '../middleware/audit.js';
import Registration from '../models/Registration.js';
import FormTemplate from '../models/FormTemplate.js';
import Couple from '../models/Couple.js';

const router = express.Router();
router.use(requireAuth);

function validateValues(values, fields) {
  for (const field of fields) {
    if (field.type === 'file') continue; // file validation handles elsewhere (documents)
    const val = values[field.key];
    if (field.required && (val === undefined || val === null || val === '')) {
      throw new HttpError(400, `Field ${field.key} is required`);
    }
  }
}

router.get('/', asyncHandler(async (req, res) => {
  const { schemeId, year, status } = req.query;
  const query = {};
  if (schemeId) query.schemeId = schemeId;
  if (year) query.year = Number(year);
  if (status) query.status = status;

  const registrations = await Registration.find(query).populate('coupleId');
  res.json(registrations);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const reg = await Registration.findById(req.params.id).populate('coupleId');
  if (!reg) throw new HttpError(404, 'Registration not found');
  res.json(reg);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { schemeId, year, side, values } = req.body;

  if (!schemeId || !year) throw new HttpError(400, 'schemeId and year are required');

  const template = await FormTemplate.findOne({ schemeId, active: true });
  if (!template) throw new HttpError(400, 'No active form template for this scheme');

  validateValues(values || {}, template.fields);

  const reg = await Registration.create({
    schemeId,
    year,
    side: side || 'na',
    formTemplateVersion: template.version,
    values: values || {},
    status: 'draft'
  });

  await audit({
    req, action: 'CREATE_REGISTRATION', entityType: 'Registration', entityId: reg._id, after: reg.toObject()
  });

  res.status(201).json(reg);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { values, side } = req.body;
  const reg = await Registration.findById(req.params.id);
  if (!reg) throw new HttpError(404, 'Registration not found');
  
  if (reg.status !== 'draft' && reg.status !== 'rejected') {
    throw new HttpError(400, 'Can only update draft or rejected registrations');
  }

  const template = await FormTemplate.findOne({ schemeId: reg.schemeId, version: reg.formTemplateVersion });
  if (template) {
    validateValues(values || {}, template.fields);
  }

  const oldReg = reg.toObject();
  if (values !== undefined) reg.values = values;
  if (side !== undefined) reg.side = side;

  await reg.save();

  await audit({
    req, action: 'UPDATE_REGISTRATION', entityType: 'Registration', entityId: reg._id, before: oldReg, after: reg.toObject()
  });

  res.json(reg);
}));

router.patch('/:id/submit', asyncHandler(async (req, res) => {
  const reg = await Registration.findById(req.params.id);
  if (!reg) throw new HttpError(404, 'Registration not found');
  
  if (reg.status !== 'draft' && reg.status !== 'rejected') {
    throw new HttpError(400, 'Registration is already submitted or verified');
  }

  const template = await FormTemplate.findOne({ schemeId: reg.schemeId, version: reg.formTemplateVersion });
  if (template) {
    validateValues(reg.values, template.fields);
  }

  const oldReg = reg.toObject();
  reg.status = 'submitted';
  await reg.save();

  await audit({
    req, action: 'SUBMIT_REGISTRATION', entityType: 'Registration', entityId: reg._id, before: oldReg, after: reg.toObject()
  });

  res.json(reg);
}));

router.post('/link-couple', asyncHandler(async (req, res) => {
  const { groomRegistrationId, brideRegistrationId, village, year } = req.body;
  
  if (!groomRegistrationId || !brideRegistrationId || !year) {
    throw new HttpError(400, 'groomRegistrationId, brideRegistrationId, and year are required');
  }

  const groom = await Registration.findById(groomRegistrationId);
  const bride = await Registration.findById(brideRegistrationId);

  if (!groom || !bride) throw new HttpError(404, 'One or both registrations not found');

  if (groom.coupleId || bride.coupleId) {
    throw new HttpError(400, 'One or both registrations are already linked');
  }

  const random4 = Math.floor(1000 + Math.random() * 9000);
  const registrationNo = `REG-${year}-${random4}`;

  const couple = await Couple.create({
    year,
    groomRegistrationId,
    brideRegistrationId,
    village,
    registrationNo
  });

  groom.coupleId = couple._id;
  bride.coupleId = couple._id;
  await groom.save();
  await bride.save();

  await audit({
    req, action: 'LINK_COUPLE', entityType: 'Couple', entityId: couple._id, after: couple.toObject()
  });

  res.status(201).json(couple);
}));

export default router;
