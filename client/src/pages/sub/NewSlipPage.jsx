import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSchemes, searchDonors, createSlip } from '../../api/resources';
import { Loading, ErrorState, FieldError } from '../../components/States';
import Receipt from '../../components/Receipt';
import { t, inr } from '../../lib/i18n';
import { isValidAmount } from '../../lib/clientMoney';

const PAY_MODES = [
  { value: 'cash', label: 'રોકડ (Cash)' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'ચેક (Cheque)' },
];

export default function NewSlipPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState('form'); // form | success
  const [donorName, setDonorName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [existingDonorId, setExistingDonorId] = useState(null);
  const [schemeId, setSchemeId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [bookNumber, setBookNumber] = useState('');
  const [errors, setErrors] = useState({});
  const [receipt, setReceipt] = useState(null);

  // Typeahead
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSugs, setShowSugs] = useState(false);

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  const schemes = schemesQ.data || [];

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try { setSuggestions(await searchDonors(query) || []); } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectDonor = (d) => {
    setDonorName(d.name || '');
    setMobile(d.mobile || '');
    setVillage(d.village || '');
    setExistingDonorId(d.id || d._id);
    setQuery(d.name);
    setShowSugs(false);
  };

  const validate = () => {
    const e = {};
    if (!isAnonymous && !donorName.trim()) e.donorName = 'નામ જરૂરી છે';
    if (!village.trim()) e.village = 'ગામ જરૂરી છે';
    if (!schemeId) e.schemeId = 'યોજના પસંદ કરો';
    if (!isValidAmount(amount)) e.amount = 'રકમ > ૦ હોવી જોઈએ';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const slipMut = useMutation({
    mutationFn: (body) => createSlip(body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['slips'] });
      const schemeName = schemes.find((s) => s.id === schemeId)?.name || '';
      setReceipt({
        slipId: data.slipId || data.id,
        amount: data.amount,
        scheme: data.scheme?.name || schemeName,
        donorName: isAnonymous ? t.anonymous : donorName,
        village,
        paymentMode,
        paymentConfirmed: paymentMode === 'cash',
        date: new Date().toISOString(),
      });
      setStep('success');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const body = {
      village: village.trim(),
      schemeId,
      amount: Number(amount),
      paymentMode,
      isAnonymous,
    };
    if (!isAnonymous) {
      body.donorName = donorName.trim();
      if (mobile.trim()) body.mobile = mobile.trim();
      if (existingDonorId) body.existingDonorId = existingDonorId;
    }
    if (bookNumber.trim()) body.bookNumber = bookNumber.trim();
    slipMut.mutate(body);
  };

  const resetForm = () => {
    setStep('form');
    setDonorName(''); setMobile(''); setVillage(''); setIsAnonymous(false);
    setExistingDonorId(null); setSchemeId(''); setAmount('');
    setPaymentMode('cash'); setBookNumber(''); setErrors({}); setReceipt(null);
    setQuery(''); setSuggestions([]);
  };

  if (schemesQ.isLoading) return <Loading />;
  if (schemesQ.error) return <ErrorState error={schemesQ.error} onRetry={schemesQ.refetch} />;

  if (step === 'success' && receipt) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4 text-center">✓ સ્લિપ બની!</h1>
        <Receipt {...receipt} />
        <button className="btn-primary w-full mt-4" onClick={resetForm}>
          + નવી સ્લિપ બનાવો
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">નવી સ્લિપ (New Slip)</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isAnonymous} onChange={(e) => { setIsAnonymous(e.target.checked); if (e.target.checked) { setDonorName(''); setMobile(''); setExistingDonorId(null); } }} />
          <span className="font-medium">{t.anonymous}</span>
        </label>

        {!isAnonymous && (
          <>
            <div className="relative">
              <label className="label">{t.name}</label>
              <input className="input" value={query || donorName} onChange={(e) => { setQuery(e.target.value); setDonorName(e.target.value); setExistingDonorId(null); setShowSugs(true); }} onFocus={() => suggestions.length > 0 && setShowSugs(true)} placeholder="દાતાનું નામ" />
              {showSugs && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border rounded-lg shadow mt-1 max-h-48 overflow-y-auto">
                  {suggestions.map((d) => (
                    <button key={d.id || d._id} type="button" className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0" onClick={() => selectDonor(d)}>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-gray-500">{d.village} {d.mobile ? `· ${d.mobile}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
              <FieldError>{errors.donorName}</FieldError>
            </div>
            <div>
              <label className="label">{t.mobile}</label>
              <input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="મોબાઈલ" />
            </div>
          </>
        )}

        <div>
          <label className="label">{t.village} *</label>
          <input className="input" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="ગામ" />
          <FieldError>{errors.village}</FieldError>
        </div>

        <div>
          <label className="label">{t.scheme} *</label>
          <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
            <option value="">— પસંદ કરો —</option>
            {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <FieldError>{errors.schemeId}</FieldError>
        </div>

        <div>
          <label className="label">{t.amount} *</label>
          <input className="input text-xl font-bold" type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹" min="1" />
          <FieldError>{errors.amount}</FieldError>
        </div>

        <div>
          <label className="label">ચૂકવણી પ્રકાર (Payment Mode)</label>
          <div className="flex gap-2">
            {PAY_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`chip flex-1 text-center ${paymentMode === m.value ? 'bg-brand text-white border-brand' : 'bg-white border-gray-300'}`}
                onClick={() => setPaymentMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">બુક નંબર (Book #)</label>
          <input className="input" value={bookNumber} onChange={(e) => setBookNumber(e.target.value)} placeholder="(વૈકલ્પિક)" />
        </div>

        {slipMut.error && <FieldError>{slipMut.error.message}</FieldError>}

        <button className="btn-primary w-full text-lg" type="submit" disabled={slipMut.isPending}>
          {slipMut.isPending ? t.loading : 'સ્લિપ બનાવો'}
        </button>
      </form>
    </div>
  );
}
