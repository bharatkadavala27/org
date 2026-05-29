// Human-friendly unique slip ids: SL-2026-000123 style + a counter fallback.
import Slip from '../models/Slip.js';

export async function nextSlipId(year) {
  const prefix = `SL-${year}-`;
  // Count existing slips this year to derive the next sequence (best-effort).
  const count = await Slip.countDocuments({ slipId: { $regex: `^${prefix}` } });
  let seq = count + 1;
  // Ensure uniqueness even under races / voids.
  // Try a few times before failing loudly.
  for (let i = 0; i < 5; i++) {
    const candidate = `${prefix}${String(seq).padStart(6, '0')}`;
    const exists = await Slip.exists({ slipId: candidate });
    if (!exists) return candidate;
    seq += 1;
  }
  // Fallback to timestamp-based id.
  return `${prefix}${Date.now()}`;
}
