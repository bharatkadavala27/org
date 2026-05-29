import crypto from 'crypto';

// Normalize Gujarati/whitespace for dedup matching.
export function normalizeName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// Stable per-row import hash for idempotency.
export function importHash({ name, village, amount, year, sourceRow }) {
  const key = [normalizeName(name), normalizeName(village), Number(amount) || 0, year, sourceRow].join('|');
  return crypto.createHash('sha1').update(key).digest('hex');
}
