import AuditLog from '../models/AuditLog.js';

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'jwt', 'secret', 'authorization'];

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of Object.keys(clone)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      clone[k] = '[redacted]';
    } else if (clone[k] && typeof clone[k] === 'object') {
      clone[k] = scrub(clone[k]);
    }
  }
  return clone;
}

/**
 * Central audit helper. Call on every money/document/user/permission change.
 * Never throws (auditing must not break the request) — logs failures only.
 */
export async function audit({ req, action, entityType, entityId, before, after }) {
  try {
    await AuditLog.create({
      ts: new Date(),
      userId: req?.user?.id || null,
      role: req?.user?.role || 'public',
      action,
      entityType,
      entityId: entityId ? String(entityId) : undefined,
      before: before ? scrub(before) : undefined,
      after: after ? scrub(after) : undefined,
    });
  } catch (err) {
    console.error('Audit write failed:', err.message);
  }
}
