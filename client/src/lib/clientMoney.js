// Client mirror of the server money policy: 2-dp rupees, summed via integer paise.
export function toPaise(rupees) {
  return Math.round(Number(rupees || 0) * 100);
}
export function sumPaise(amounts) {
  const p = amounts.reduce((acc, a) => acc + toPaise(a), 0);
  return p / 100;
}
export function round2(rupees) {
  return Math.round(Number(rupees || 0) * 100) / 100;
}
export function isValidAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

export function formatRupees(rupees) {
  const v = round2(rupees);
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
