import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSchemes, getUpiSettings, searchDonors, createDonation, uploadFile, markDonationPaid } from '../api/resources';
import { Loading, ErrorState, FieldError } from '../components/States';
import Brand from '../components/Brand';
import Receipt from '../components/Receipt';
import { t, inr } from '../lib/i18n';
import { buildUpiLink } from '../lib/upi';
import QRCode from 'qrcode';

const QUICK_AMOUNTS = [101, 501, 1100];

export default function DonatePage() {
  const [step, setStep] = useState('form');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [village, setVillage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [existingDonorId, setExistingDonorId] = useState(null);
  const [schemeId, setSchemeId] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  const [slipResult, setSlipResult] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  const upiQ = useQuery({ queryKey: ['upiSettings'], queryFn: getUpiSettings });
  const schemes = schemesQ.data || [];
  const upiSettings = upiQ.data || {};

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await searchDonors(query);
        setSuggestions(res || []);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectDonor = (d) => {
    setName(d.name || '');
    setMobile(d.mobile || '');
    setVillage(d.village || '');
    setExistingDonorId(d.id || d._id);
    setShowSuggestions(false);
    setQuery(d.name);
  };

  const validate = () => {
    const e = {};
    if (!isAnonymous && !name.trim()) e.name = 'નામ જરૂરી છે';
    if (!schemeId) e.schemeId = 'યોજના પસંદ કરો';
    const amt = Number(amount);
    if (!amt || amt <= 0) e.amount = 'રકમ > ૦ હોવી જોઈએ';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const donateMut = useMutation({
    mutationFn: (body) => createDonation(body),
    onSuccess: async (data) => {
      setSlipResult(data);
      if (upiSettings.qrImageUrl) {
        setQrDataUrl('');
        setStep('payment');
        return;
      }
      const upiLink = buildUpiLink({
        payeeVpa: upiSettings.payeeVpa,
        payeeName: upiSettings.payeeName,
        amount: data.amount,
        note: `Donation ${data.slipId}`,
      });
      if (upiLink) {
        try {
          const url = await QRCode.toDataURL(upiLink, { width: 300, margin: 2 });
          setQrDataUrl(url);
        } catch { /* QR generation failed */ }
      }
      setStep('payment');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitError('');
    const body = { isAnonymous, schemeId, amount: Number(amount) };
    if (!isAnonymous) {
      body.name = name.trim();
      if (mobile.trim()) body.mobile = mobile.trim();
      if (village.trim()) body.village = village.trim();
      if (existingDonorId) body.existingDonorId = existingDonorId;
    }
    donateMut.mutate(body);
  };

  const handlePaid = async (file) => {
    if (!slipResult?.slipId) return;
    setUploadBusy(true);
    try {
      let receiptUrl;
      if (file) {
        const up = await uploadFile(file, 'receipts');
        receiptUrl = up.url;
      }
      await markDonationPaid(slipResult.slipId, { receiptUrl });
      setReceipt({
        slipId: slipResult.slipId,
        amount: slipResult.amount,
        scheme: slipResult.scheme?.name || slipResult.scheme || '',
        donorName: isAnonymous ? t.anonymous : name,
        village,
        paymentMode: 'upi',
        paymentConfirmed: false,
        date: new Date().toISOString(),
      });
      setStep('success');
    } catch (err) {
      setSubmitError(err.message || t.error);
    } finally {
      setUploadBusy(false);
    }
  };

  if (schemesQ.isLoading || upiQ.isLoading) return <Loading />;
  if (schemesQ.error) return <ErrorState error={schemesQ.error} onRetry={schemesQ.refetch} />;

  if (step === 'success' && receipt) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <div className="text-4xl mb-2">🙏</div>
          <h2 className="text-xl font-bold mb-1">{t.thankYou}</h2>
          <p className="text-gray-500 text-sm mb-4">{t.paymentUnconfirmed}</p>
          <Receipt {...receipt} />
        </div>
      </div>
    );
  }

  if (step === 'payment' && slipResult) {
    const upiLink = buildUpiLink({
      payeeVpa: upiSettings.payeeVpa,
      payeeName: upiSettings.payeeName,
      amount: slipResult.amount,
      note: `Donation ${slipResult.slipId}`,
    });
    const displayQrUrl = upiSettings.qrImageUrl || qrDataUrl;

    return (
      <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
        <div className="card max-w-md w-full text-center">
          <Brand />
          <h2 className="text-xl font-bold mt-4 mb-1">{t.scanToPay}</h2>
          <p className="text-2xl font-bold text-brand mb-4">{inr(slipResult.amount)}</p>
          {displayQrUrl ? (
            <img src={displayQrUrl} alt="UPI QR" className="mx-auto mb-4 h-64 w-64 rounded-lg border object-contain p-2" />
          ) : (
            <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
              UPI QR is not configured. Please contact the trust office before paying.
            </div>
          )}
          {upiLink && (
            <a href={upiLink} className="btn-primary w-full mb-3 block text-center">
              {t.payVia}
            </a>
          )}
          <hr className="my-4" />
          <p className="text-sm text-gray-500 mb-3">{t.uploadScreenshot}</p>
          <input
            type="file"
            accept="image/*"
            className="input mb-3"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePaid(f);
            }}
          />
          <button className="btn-secondary w-full" onClick={() => handlePaid(null)} disabled={uploadBusy}>
            {uploadBusy ? t.loading : t.iHavePaid}
          </button>
          {submitError && <FieldError>{submitError}</FieldError>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center">
      <div className="card max-w-md w-full">
        <div className="flex justify-center mb-4"><Brand /></div>
        <h1 className="text-xl font-bold text-center mb-6">{t.donate}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isAnonymous} onChange={(e) => { setIsAnonymous(e.target.checked); if (e.target.checked) { setName(''); setMobile(''); setVillage(''); setExistingDonorId(null); } }} />
            <span className="font-medium">{t.anonymous}</span>
          </label>

          {!isAnonymous && (
            <>
              <div className="relative">
                <label className="label">{t.name}</label>
                <input
                  className="input"
                  value={query || name}
                  onChange={(e) => { setQuery(e.target.value); setName(e.target.value); setExistingDonorId(null); setShowSuggestions(true); }}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="દાતાનું નામ"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded-lg shadow mt-1 max-h-48 overflow-y-auto">
                    {suggestions.map((d) => (
                      <button
                        key={d.id || d._id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0"
                        onClick={() => selectDonor(d)}
                      >
                        <div className="font-medium">{d.name}</div>
                        <div className="text-xs text-gray-500">{d.village} {d.mobile ? `· ${d.mobile}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
                <FieldError>{errors.name}</FieldError>
              </div>
              <div>
                <label className="label">{t.mobile}</label>
                <input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="મોબાઈલ નંબર" />
              </div>
              <div>
                <label className="label">{t.village}</label>
                <input className="input" value={village} onChange={(e) => setVillage(e.target.value)} placeholder="ગામ" />
              </div>
            </>
          )}

          <div>
            <label className="label">{t.scheme}</label>
            <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
              <option value="">— પસંદ કરો —</option>
              {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <FieldError>{errors.schemeId}</FieldError>
          </div>

          <div>
            <label className="label">{t.amount}</label>
            <input
              className="input text-2xl text-center font-bold"
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="₹"
              min="1"
            />
            <div className="flex gap-2 mt-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`chip flex-1 text-center ${Number(amount) === a ? 'bg-brand text-white border-brand' : 'bg-white border-gray-300'}`}
                  onClick={() => setAmount(String(a))}
                >
                  {inr(a)}
                </button>
              ))}
            </div>
            <FieldError>{errors.amount}</FieldError>
          </div>

          {submitError && <FieldError>{submitError}</FieldError>}
          {donateMut.error && <FieldError>{donateMut.error.message}</FieldError>}

          <button className="btn-primary w-full text-lg" type="submit" disabled={donateMut.isPending}>
            {donateMut.isPending ? t.loading : t.donate}
          </button>
        </form>
      </div>
    </div>
  );
}
