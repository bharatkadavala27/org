// Build a UPI deep link. All values URL-encoded.
// upi://pay?pa={vpa}&pn={name}&am={amount}&cu=INR&tn={note}
export function buildUpiLink({ payeeVpa, payeeName, amount, note }) {
  if (!payeeVpa) return '';
  const params = new URLSearchParams();
  params.set('pa', payeeVpa);
  if (payeeName) params.set('pn', payeeName);
  if (amount != null && Number(amount) > 0) params.set('am', Number(amount).toFixed(2));
  params.set('cu', 'INR');
  if (note) params.set('tn', note);
  // URLSearchParams encodes spaces as '+', but UPI apps expect %20 — normalize.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}
