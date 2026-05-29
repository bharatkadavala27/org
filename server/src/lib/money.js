// Money policy: stored as 2-decimal-place RUPEES (Number).
// All arithmetic must go through these helpers to avoid float drift.
// Internally we compute in integer paise, then convert back.

export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function toRupees(paise) {
  return Math.round(paise) / 100;
}

/** Round a rupee value to 2 dp safely. */
export function round2(rupees) {
  return toRupees(toPaise(rupees));
}

/** Sum an array of rupee amounts without float drift. */
export function sumRupees(amounts) {
  const totalPaise = amounts.reduce((acc, a) => acc + toPaise(a || 0), 0);
  return toRupees(totalPaise);
}

/** Validate a money input is a finite number > 0. */
export function isValidAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}
