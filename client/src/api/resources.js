import { api } from './client';

// ---- Schemes ----
export const getSchemes = () => api.get('/api/schemes').then((r) => r.data);

// ---- Settings (UPI & Theme) ----
export const getUpiSettings = () => api.get('/api/settings/upi').then((r) => r.data);
export const saveUpiSettings = (body) => api.put('/api/settings/upi', body).then((r) => r.data);
export const getBrandingSettings = () => api.get('/api/settings/branding').then((r) => r.data);
export const saveBrandingSettings = (body) => api.put('/api/settings/branding', body).then((r) => r.data);

// ---- Public donation ----
export const searchDonors = (q) => api.get('/api/donors/search', { params: { q } }).then((r) => r.data);
export const createDonation = (body) => api.post('/api/donors/donate', body).then((r) => r.data);
export const markDonationPaid = (slipId, body) =>
  api.patch(`/api/donors/donate/${slipId}/paid`, body).then((r) => r.data);

// ---- Uploads ----
export const uploadFile = (file, folder) => {
  const fd = new FormData();
  fd.append('file', file);
  return api
    .post('/api/uploads', fd, { params: { folder }, headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

// ---- Users (admin) ----
export const getUsers = () => api.get('/api/users').then((r) => r.data);
export const createUser = (body) => api.post('/api/users', body).then((r) => r.data);
export const updateUser = (id, body) => api.patch(`/api/users/${id}`, body).then((r) => r.data);

// ---- Donors (auth) ----
export const getDonors = () => api.get('/api/donors').then((r) => r.data);

// ---- Slips ----
export const getSlips = (params) => api.get('/api/slips', { params }).then((r) => r.data);
export const getSlip = (slipId) => api.get(`/api/slips/${slipId}`).then((r) => r.data);
export const createSlip = (body) => api.post('/api/slips', body).then((r) => r.data);
export const confirmSlip = (slipId) => api.patch(`/api/slips/${slipId}/confirm`).then((r) => r.data);
export const voidSlip = (slipId, reason) => api.patch(`/api/slips/${slipId}/void`, { reason }).then((r) => r.data);

// ---- Handovers ----
export const getHandovers = (params) => api.get('/api/handovers', { params }).then((r) => r.data);
export const getHandover = (id) => api.get(`/api/handovers/${id}`).then((r) => r.data);
export const createHandover = (body) => api.post('/api/handovers', body).then((r) => r.data);
export const confirmHandover = (id) => api.patch(`/api/handovers/${id}/confirm`).then((r) => r.data);
export const disputeHandover = (id, note) => api.patch(`/api/handovers/${id}/dispute`, { note }).then((r) => r.data);

// ---- Import ----
export const validateImport = (body) => api.post('/api/import/validate', body).then((r) => r.data);
export const commitImport = (body) => api.post('/api/import/commit', body).then((r) => r.data);

// ---- Audit ----
export const getAudit = (params) => api.get('/api/audit', { params }).then((r) => r.data);
export const auditCsvUrl = (params) => {
  const qs = new URLSearchParams(params).toString();
  return `${import.meta.env.VITE_API_URL}/api/audit/export.csv?${qs}`;
};

// ---- Expenses ----
export const getExpenses = (params) => api.get('/api/expenses', { params }).then((r) => r.data);
export const createExpense = (body) => api.post('/api/expenses', body).then((r) => r.data);
export const approveExpense = (id) => api.patch(`/api/expenses/${id}/approve`).then((r) => r.data);
export const rejectExpense = (id, reason) => api.patch(`/api/expenses/${id}/reject`, { reason }).then((r) => r.data);

// ---- Budgets ----
export const getBudgets = (params) => api.get('/api/budgets', { params }).then((r) => r.data);
export const saveBudget = (body) => api.put('/api/budgets', body).then((r) => r.data);
export const getBudgetVariance = (params) => api.get('/api/budgets/variance', { params }).then((r) => r.data);

// ---- Donor merge ----
export const getDonorMergeSuggestions = (params) =>
  api.get('/api/donor-merge/suggestions', { params }).then((r) => r.data);
export const mergeDonors = (body) => api.post('/api/donor-merge/merge', body).then((r) => r.data);

// ---- Form Templates ----
export const getFormTemplates = (schemeId) => api.get('/api/form-templates', { params: { schemeId } }).then((r) => r.data);
export const getActiveTemplate = (schemeId) => api.get(`/api/form-templates/active/${schemeId}`).then((r) => r.data);
export const createFormTemplate = (body) => api.post('/api/form-templates', body).then((r) => r.data);
export const updateFormTemplate = (id, body) => api.put(`/api/form-templates/${id}`, body).then((r) => r.data);

// ---- Registrations ----
export const getRegistrations = (params) => api.get('/api/registrations', { params }).then((r) => r.data);
export const getRegistration = (id) => api.get(`/api/registrations/${id}`).then((r) => r.data);
export const createRegistration = (body) => api.post('/api/registrations', body).then((r) => r.data);
export const updateRegistration = (id, body) => api.patch(`/api/registrations/${id}`, body).then((r) => r.data);
export const submitRegistration = (id) => api.patch(`/api/registrations/${id}/submit`).then((r) => r.data);
export const linkCouple = (body) => api.post('/api/registrations/link-couple', body).then((r) => r.data);

// ---- Documents ----
export const getDocuments = (params) => api.get('/api/documents', { params }).then((r) => r.data);
export const getExpiringDocs = (days) => api.get('/api/documents/expiring', { params: { days } }).then((r) => r.data);
export const createDocument = (body) => api.post('/api/documents', body).then((r) => r.data);
export const verifyDocument = (id) => api.patch(`/api/documents/${id}/verify`).then((r) => r.data);
export const rejectDocument = (id, reason) => api.patch(`/api/documents/${id}/reject`, { reason }).then((r) => r.data);
export const resubmitDocument = (id, body) => api.post(`/api/documents/${id}/resubmit`, body).then((r) => r.data);
