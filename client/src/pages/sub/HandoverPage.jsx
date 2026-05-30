import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSlips, getHandovers, createHandover } from '../../api/resources';
import { Loading, EmptyState, ErrorState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t, inr } from '../../lib/i18n';
import { sumPaise, toPaise } from '../../lib/clientMoney';

export default function HandoverPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState({});
  const [receivedTotal, setReceivedTotal] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  const slipsQ = useQuery({
    queryKey: ['slips', 'handoverEligible'],
    queryFn: () => getSlips({ handoverEligible: true }),
  });
  const handoversQ = useQuery({
    queryKey: ['handovers', 'mine'],
    queryFn: () => getHandovers(),
  });

  const eligibleSlips = Array.isArray(slipsQ.data) ? slipsQ.data : (slipsQ.data?.slips || []);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const selectedSlips = eligibleSlips.filter((s) => selectedIds.includes(String(s.id || s._id)));
  const expectedTotal = useMemo(() => sumPaise(selectedSlips.map((s) => s.amount)), [selectedSlips]);
  const receivedNum = Number(receivedTotal) || 0;
  const variancePaise = toPaise(receivedNum) - toPaise(expectedTotal);
  const variance = variancePaise / 100;

  const toggleSlip = (slip) => {
    const key = slip.id || slip._id;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const selectAll = () => {
    const all = {};
    eligibleSlips.forEach((s) => { all[s.id || s._id] = true; });
    setSelected(all);
  };

  const validate = () => {
    const e = {};
    if (selectedIds.length === 0) e.slips = 'ઓછામાં ઓછી ૧ સ્લિપ પસંદ કરો';
    if (!receivedTotal || receivedNum <= 0) e.receivedTotal = 'પ્રાપ્ત રકમ ભરો';
    if (variance !== 0 && !note.trim()) e.note = 'તફાવત હોય ત્યારે નોંધ જરૂરી છે';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handoverMut = useMutation({
    mutationFn: (body) => createHandover(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slips'] });
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      setSelected({});
      setReceivedTotal('');
      setNote('');
      setConfirmOpen(false);
    },
  });

  const handleSubmit = () => { if (validate()) setConfirmOpen(true); };
  const doSubmit = () => {
    handoverMut.mutate({ slipIds: selectedIds, receivedTotal: receivedNum, note: note.trim() || undefined });
  };

  if (slipsQ.isLoading) return <Loading />;
  if (slipsQ.error) return <ErrorState error={slipsQ.error} onRetry={slipsQ.refetch} />;

  const handovers = handoversQ.data || [];

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">હેન્ડઓવર (Handover)</h1>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">રોકડ સ્લિપ પસંદ કરો</h2>
          {eligibleSlips.length > 0 && (
            <button className="text-sm text-brand underline" onClick={selectAll}>બધી પસંદ</button>
          )}
        </div>

        {eligibleSlips.length === 0 ? (
          <EmptyState title="કોઈ સ્લિપ ઉપલબ્ધ નથી" hint="રોકડ ચૂકવણી ખાતરી થયેલ સ્લિપ જ હેન્ડઓવર થઈ શકે" />
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {eligibleSlips.map((slip) => {
              const key = String(slip.id || slip._id);
              const isSelected = !!selected[key];
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${isSelected ? 'bg-brand/5 border-brand' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSlip(slip)} className="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{slip.slipId || key}</div>
                    <div className="text-xs text-gray-500">{slip.donor?.name || slip.donorName || t.anonymous} · {slip.donor?.village || slip.village || ''}</div>
                  </div>
                  <span className="font-semibold">{inr(slip.amount)}</span>
                </label>
              );
            })}
          </div>
        )}
        <FieldError>{errors.slips}</FieldError>
      </div>

      {selectedIds.length > 0 && (
        <div className="card mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-gray-500">અપેક્ષિત (Expected):</span>
            <span className="font-bold">{inr(expectedTotal)}</span>
          </div>
          <div>
            <label className="label">પ્રાપ્ત રકમ (Received) *</label>
            <input className="input text-lg font-bold" type="number" inputMode="numeric" value={receivedTotal} onChange={(e) => setReceivedTotal(e.target.value)} placeholder="₹" />
            <FieldError>{errors.receivedTotal}</FieldError>
          </div>
          {receivedTotal && (
            <div className={`flex justify-between mt-2 font-bold ${variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
              <span>તફાવત (Variance):</span>
              <span>{inr(variance)}</span>
            </div>
          )}
          {variance !== 0 && receivedTotal && (
            <div className="mt-2">
              <label className="label">નોંધ (Note) * <span className="text-red-500 text-xs">તફાવત હોય ત્યારે જરૂરી</span></label>
              <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="તફાવત કારણ" />
              <FieldError>{errors.note}</FieldError>
            </div>
          )}
          {handoverMut.error && <FieldError>{handoverMut.error.message}</FieldError>}
          <button className="btn-primary w-full mt-4" onClick={handleSubmit} disabled={handoverMut.isPending}>
            {handoverMut.isPending ? t.loading : `હેન્ડઓવર સબમિટ (${selectedIds.length} સ્લિપ)`}
          </button>
        </div>
      )}

      {handovers.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold mb-3">ભૂતકાળના હેન્ડઓવર</h2>
          <div className="space-y-3">
            {handovers.map((h) => {
              const hid = h.id || h._id;
              const hasVariance = h.variance !== 0 && h.variance != null;
              return (
                <div key={hid} className="card">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-500">{new Date(h.createdAt).toLocaleDateString('gu-IN')}</span>
                    <span className={`chip text-xs py-0.5 px-2 ${h.status === 'confirmed' ? 'bg-green-100 border-green-300 text-green-700' : h.status === 'disputed' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-yellow-100 border-yellow-300 text-yellow-700'}`}>
                      {h.status === 'confirmed' ? 'ખાતરી' : h.status === 'disputed' ? 'વિવાદ' : 'બાકી'}
                    </span>
                  </div>
                  <div className="text-sm space-y-0.5">
                    <div>અપેક્ષિત: {inr(h.expectedTotal)} · પ્રાપ્ત: {inr(h.receivedTotal)}</div>
                    {hasVariance && <div className="text-red-600 font-semibold">તફાવત: {inr(h.variance)}</div>}
                    <div className="text-xs text-gray-500">{h.slipCount || h.slips?.length || 0} સ્લિપ</div>
                    {h.note && <div className="text-xs text-gray-600">નોંધ: {h.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="હેન્ડઓવર ખાતરી (Submit Handover)"
        message={`${selectedIds.length} સ્લિપ · અપેક્ષિત: ${inr(expectedTotal)}`}
        detail={
          <div className="space-y-1">
            <div>પ્રાપ્ત: {inr(receivedNum)}</div>
            {variance !== 0 && <div className="text-red-600 font-bold">તફાવત: {inr(variance)}</div>}
            {note && <div>નોંધ: {note}</div>}
          </div>
        }
        confirmLabel="સબમિટ કરો"
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
        busy={handoverMut.isPending}
      />
    </div>
  );
}
