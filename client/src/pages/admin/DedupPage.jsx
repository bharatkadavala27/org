import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getDonorMergeSuggestions, mergeDonors } from '../../api/resources';
import { EmptyState, ErrorState, FieldError, Loading } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { inr, t } from '../../lib/i18n';
import { sumPaise } from '../../lib/clientMoney';

function confidenceClass(score) {
  if (score >= 90) return 'bg-green-100 border-green-300 text-green-700';
  if (score >= 80) return 'bg-yellow-100 border-yellow-300 text-yellow-700';
  return 'bg-orange-100 border-orange-300 text-orange-700';
}

function DonorCard({ donor, primaryId, onPrimaryChange }) {
  const isPrimary = donor.id === primaryId;
  return (
    <div className={`card ${isPrimary ? 'border-brand ring-1 ring-brand' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold">{donor.name || 'Unnamed donor'}</div>
          <div className="text-sm text-gray-500">{donor.fatherOrHusbandName || 'No father/husband name'}</div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <input
            type="radio"
            name="primaryDonor"
            checked={isPrimary}
            onChange={() => onPrimaryChange(donor.id)}
          />
          {t.primaryDonor}
        </label>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div><span className="text-gray-500">{t.village}:</span> {donor.village || '-'}</div>
        <div><span className="text-gray-500">{t.mobile}:</span> {donor.mobile || '-'}</div>
        <div><span className="text-gray-500">Taluka:</span> {donor.taluka || '-'}</div>
        <div><span className="text-gray-500">Jilla:</span> {donor.jilla || '-'}</div>
        <div><span className="text-gray-500">Active slips:</span> {donor.slipCount}</div>
        <div><span className="text-gray-500">All slips to reattach:</span> {donor.allSlipCount}</div>
      </div>
      <div className="mt-3 text-sm">
        <span className="text-gray-500">Lifetime total:</span> <span className="font-semibold">{inr(donor.lifetimeTotal)}</span>
      </div>
    </div>
  );
}

export default function DedupPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeResult, setMergeResult] = useState(null);

  const suggestionsQ = useQuery({
    queryKey: ['donorMergeSuggestions'],
    queryFn: () => getDonorMergeSuggestions({ limit: 1000 }),
  });

  const suggestions = suggestionsQ.data || [];

  useEffect(() => {
    if (!selectedId && suggestions.length) setSelectedId(suggestions[0].id);
  }, [selectedId, suggestions]);

  const selected = useMemo(
    () => suggestions.find((suggestion) => suggestion.id === selectedId) || suggestions[0],
    [selectedId, suggestions]
  );

  useEffect(() => {
    if (selected && !selected.donors.some((donor) => donor.id === primaryId)) {
      setPrimaryId(selected.donors[0]?.id || '');
    }
  }, [selected, primaryId]);

  const mergeMut = useMutation({
    mutationFn: (body) => mergeDonors(body),
    onSuccess: (result) => {
      setMergeResult(result);
      setConfirmOpen(false);
      setMergeError('');
      queryClient.invalidateQueries({ queryKey: ['donorMergeSuggestions'] });
    },
  });

  const primary = selected?.donors.find((donor) => donor.id === primaryId);
  const losers = selected?.donors.filter((donor) => donor.id !== primaryId) || [];
  const combinedTotal = selected ? sumPaise(selected.donors.map((donor) => donor.lifetimeTotal)) : 0;
  const reattachCount = losers.reduce((acc, donor) => acc + donor.allSlipCount, 0);

  const handleMerge = async () => {
    if (!selected || !primaryId || losers.length === 0) return;
    setMergeError('');
    try {
      await mergeMut.mutateAsync({
        primaryDonorId: primaryId,
        loserDonorIds: losers.map((donor) => donor.id),
      });
    } catch (err) {
      setMergeError(err.message || 'Could not merge donors.');
    }
  };

  if (suggestionsQ.isLoading) return <Loading />;
  if (suggestionsQ.error) return <ErrorState error={suggestionsQ.error} onRetry={suggestionsQ.refetch} />;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">{t.donorDedupTitle}</h1>
        <button className="btn-secondary py-2 px-3 text-sm" onClick={() => suggestionsQ.refetch()}>
          Refresh
        </button>
      </div>

      {mergeResult && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Merged {mergeResult.loserDonorIds.length} donor(s). Reattached {mergeResult.reattachedSlipCount} slip(s).
          Lifetime total reconciled: {inr(mergeResult.beforeTotal)} before = {inr(mergeResult.afterTotal)} after.
        </div>
      )}

      {suggestions.length === 0 ? (
        <EmptyState title="No duplicate donor suggestions" hint="No donors were merged automatically." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm ${selected?.id === suggestion.id ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}
                onClick={() => {
                  setSelectedId(suggestion.id);
                  setMergeResult(null);
                  setMergeError('');
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{suggestion.donors.map((donor) => donor.name).join(' / ')}</div>
                  <span className={`chip text-xs py-1 px-2 ${confidenceClass(suggestion.confidence)}`}>
                    {suggestion.confidence}%
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {suggestion.donors.length} donors - {inr(suggestion.combinedTotal)}
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <div>
              <div className="card mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="font-bold">Combined contribution preview</div>
                    <div className="mt-1 text-sm text-gray-500">
                      {selected.totalSlipCount} active slip(s), {selected.totalReattachCount} total slip(s) in the merge set
                    </div>
                    {selected.reasons?.length > 0 && (
                      <div className="mt-2 text-sm text-gray-600">
                        Match: {selected.reasons.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Combined total</div>
                    <div className="text-2xl font-bold">{inr(combinedTotal)}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {selected.donors.map((donor) => (
                  <DonorCard key={donor.id} donor={donor} primaryId={primaryId} onPrimaryChange={setPrimaryId} />
                ))}
              </div>

              <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  Primary: <span className="font-semibold">{primary?.name || '-'}</span>. Reattach {reattachCount} slip(s) from duplicate donor record(s).
                </div>
                <button className="btn-danger" onClick={() => setConfirmOpen(true)} disabled={!primaryId || losers.length === 0}>
                  {t.merge}
                </button>
              </div>
              <FieldError>{mergeError}</FieldError>
            </div>
          ) : (
            <EmptyState title="Select a suggestion" />
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Merge donor records"
        message="This will not delete donor records. Duplicate donors will point to the primary donor."
        danger
        detail={
          selected && (
            <div className="space-y-2">
              <div><span className="font-semibold">Primary:</span> {primary?.name} ({primary?.village || '-'})</div>
              <div className="font-semibold">Reattach exactly:</div>
              {losers.map((donor) => (
                <div key={donor.id} className="rounded border bg-white p-2">
                  {donor.allSlipCount} slip(s) from {donor.name} to {primary?.name}; active total {inr(donor.lifetimeTotal)}
                </div>
              ))}
              <div className="pt-1 font-semibold">
                Resulting primary lifetime total: {inr(combinedTotal)}
              </div>
              <FieldError>{mergeError}</FieldError>
            </div>
          )
        }
        confirmLabel="Merge donors"
        onConfirm={handleMerge}
        onCancel={() => setConfirmOpen(false)}
        busy={mergeMut.isPending}
      />
    </div>
  );
}
