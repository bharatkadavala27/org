import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHandovers, confirmHandover, disputeHandover } from '../../api/resources';
import { Loading, EmptyState, ErrorState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t, inr } from '../../lib/i18n';
import { sumPaise } from '../../lib/clientMoney';

const FILTERS = [
  { key: 'all', label: 'બધા (All)', params: {} },
  { key: 'submitted', label: 'બાકી (Pending)', params: { status: 'submitted' } },
  { key: 'confirmed', label: 'ખાતરી (Confirmed)', params: { status: 'confirmed' } },
  { key: 'disputed', label: 'વિવાદ (Disputed)', params: { status: 'disputed' } },
];

function statusChipClass(status) {
  switch (status) {
    case 'confirmed': return 'bg-green-100 border-green-300 text-green-700';
    case 'disputed': return 'bg-red-100 border-red-300 text-red-700';
    default: return 'bg-yellow-100 border-yellow-300 text-yellow-700';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'confirmed': return 'ખાતરી';
    case 'disputed': return 'વિવાદ';
    default: return 'બાકી';
  }
}

export default function HandoversReviewPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [disputeNote, setDisputeNote] = useState('');
  const [disputeNoteErr, setDisputeNoteErr] = useState('');
  const [expanded, setExpanded] = useState({});

  const activeFilter = FILTERS.find((f) => f.key === filter);

  const { data: handovers, isLoading, error, refetch } = useQuery({
    queryKey: ['handovers', 'admin', filter],
    queryFn: () => getHandovers(activeFilter.params),
  });

  const confirmMut = useMutation({
    mutationFn: (id) => confirmHandover(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      setConfirmTarget(null);
    },
  });

  const disputeMut = useMutation({
    mutationFn: ({ id, note }) => disputeHandover(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handovers'] });
      setDisputeTarget(null);
      setDisputeNote('');
    },
  });

  const handleDisputeSubmit = () => {
    if (!disputeNote.trim()) {
      setDisputeNoteErr('નોંધ જરૂરી છે');
      return;
    }
    setDisputeNoteErr('');
    const hid = disputeTarget?.id || disputeTarget?._id;
    disputeMut.mutate({ id: hid, note: disputeNote.trim() });
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const list = handovers || [];
  const pendingCount = list.filter((h) => h.status === 'submitted').length;
  const confirmedTotal = sumPaise(
    list.filter((h) => h.status === 'confirmed').map((h) => h.receivedTotal)
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">હેન્ડઓવર સમીક્ષા (Handovers)</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card text-center">
          <div className="text-sm text-gray-500">સમીક્ષા બાકી (Pending)</div>
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
        </div>
        <div className="card text-center">
          <div className="text-sm text-gray-500">ખાતરી થયેલ રકમ</div>
          <div className="text-2xl font-bold text-green-700">{inr(confirmedTotal)}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip whitespace-nowrap ${filter === f.key ? 'bg-brand text-white border-brand' : 'bg-white border-gray-300 text-gray-700'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Handover Cards */}
      {list.length === 0 ? (
        <EmptyState title={t.noData} />
      ) : (
        <div className="space-y-3">
          {list.map((h) => {
            const hid = h.id || h._id;
            const subAdminName = typeof h.subAdmin === 'object' ? h.subAdmin?.name : (h.submittedBy?.name || h.subAdmin || '—');
            const slipCount = h.slipCount || (h.slips?.length || 0);
            const hasVariance = h.variance !== 0 && h.variance != null;

            return (
              <div key={hid} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold">{subAdminName}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(h.createdAt).toLocaleDateString('gu-IN')} · {slipCount} સ્લિપ
                    </div>
                  </div>
                  <span className={`chip text-xs py-0.5 px-2 ${statusChipClass(h.status)}`}>
                    {statusLabel(h.status)}
                  </span>
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                  <div>
                    <div className="text-gray-500">અપેક્ષિત</div>
                    <div className="font-semibold">{inr(h.expectedTotal)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">પ્રાપ્ત</div>
                    <div className="font-semibold">{inr(h.receivedTotal)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">તફાવત</div>
                    <div className={`font-semibold ${hasVariance ? 'text-red-600' : 'text-green-600'}`}>
                      {inr(h.variance || 0)}
                    </div>
                  </div>
                </div>

                {h.note && (
                  <div className="text-sm bg-gray-50 border rounded-lg p-2 mb-2 text-gray-700">
                    <span className="font-medium">નોંધ: </span>{h.note}
                  </div>
                )}

                {/* Expandable Slip List */}
                {h.slips && h.slips.length > 0 && (
                  <div className="mb-2">
                    <button
                      className="text-sm text-brand underline"
                      onClick={() => toggleExpand(hid)}
                    >
                      {expanded[hid] ? '▾ સ્લિપ છુપાવો' : '▸ સ્લિપ જુઓ'}
                    </button>
                    {expanded[hid] && (
                      <div className="mt-2 space-y-1">
                        {h.slips.map((slip, i) => {
                          const sname = slip.donor?.name || slip.donorName || (slip.isAnonymous ? t.anonymous : '—');
                          return (
                            <div key={slip.slipId || slip.id || slip._id || i} className="bg-gray-50 rounded-lg p-2 text-sm flex items-center justify-between">
                              <div>
                                <span className="font-medium">{slip.slipId || `#${i + 1}`}</span>
                                <span className="text-gray-500 ml-2">{sname}</span>
                              </div>
                              <span className="font-semibold">{inr(slip.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {h.status === 'submitted' && (
                  <div className="flex gap-2 mt-2">
                    <button className="btn-primary py-2 px-3 text-sm" onClick={() => setConfirmTarget(h)}>
                      ✓ ખાતરી કરો
                    </button>
                    <button
                      className="btn-danger py-2 px-3 text-sm"
                      onClick={() => {
                        setDisputeTarget(h);
                        setDisputeNote('');
                        setDisputeNoteErr('');
                      }}
                    >
                      ✕ વિવાદ
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Handover Dialog */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="હેન્ડઓવર ખાતરી (Confirm Handover)"
        message={`${typeof confirmTarget?.subAdmin === 'object' ? confirmTarget?.subAdmin?.name : (confirmTarget?.submittedBy?.name || '')} ના હેન્ડઓવર ની ખાતરી`}
        detail={
          confirmTarget && (
            <div className="space-y-1">
              <div>અપેક્ષિત: {inr(confirmTarget.expectedTotal)}</div>
              <div>પ્રાપ્ત: {inr(confirmTarget.receivedTotal)}</div>
              <div className={confirmTarget.variance !== 0 ? 'text-red-600 font-bold' : ''}>
                તફાવત: {inr(confirmTarget.variance || 0)}
              </div>
            </div>
          )
        }
        confirmLabel="ખાતરી કરો"
        onConfirm={() => confirmMut.mutate(confirmTarget?.id || confirmTarget?._id)}
        onCancel={() => setConfirmTarget(null)}
        busy={confirmMut.isPending}
      />

      {/* Dispute Dialog */}
      <ConfirmDialog
        open={!!disputeTarget}
        title="હેન્ડઓવર વિવાદ (Dispute Handover)"
        message={`${typeof disputeTarget?.subAdmin === 'object' ? disputeTarget?.subAdmin?.name : (disputeTarget?.submittedBy?.name || '')} ના હેન્ડઓવર`}
        danger
        detail={
          disputeTarget && (
            <div>
              <div className="mb-2 text-sm">
                અપેક્ષિત: {inr(disputeTarget.expectedTotal)} · પ્રાપ્ત: {inr(disputeTarget.receivedTotal)}
              </div>
              <label className="label">વિવાદ નોંધ (Note) *</label>
              <textarea
                className="input"
                rows={3}
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="વિવાદ કારણ લખો"
              />
              <FieldError>{disputeNoteErr}</FieldError>
            </div>
          )
        }
        confirmLabel="વિવાદ કરો"
        onConfirm={handleDisputeSubmit}
        onCancel={() => { setDisputeTarget(null); setDisputeNote(''); }}
        busy={disputeMut.isPending}
      />
    </div>
  );
}
