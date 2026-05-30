import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHandovers, confirmHandover, disputeHandover, resolveHandover } from '../../api/resources';
import { Loading, EmptyState, ErrorState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t, inr } from '../../lib/i18n';
import { sumPaise } from '../../lib/clientMoney';

const FILTERS = [
  { key: 'all', label: 'બધા (All)', params: {} },
  { key: 'submitted', label: 'બાકી (Pending)', params: { status: 'submitted' } },
  { key: 'confirmed', label: 'ખાતરી (Confirmed)', params: { status: 'confirmed' } },
  { key: 'disputed', label: 'વિવાદ (Disputed)', params: { status: 'disputed' } },
  { key: 'resolved', label: 'ઉકેલાયેલ (Resolved)', params: { status: 'resolved' } },
];

function statusChipClass(status) {
  switch (status) {
    case 'confirmed': return 'bg-green-100/50 border-green-200 text-green-700';
    case 'disputed': return 'bg-red-100/50 border-red-200 text-red-700 shadow-sm shadow-red-200/50';
    case 'resolved': return 'bg-blue-100/50 border-blue-200 text-blue-700';
    default: return 'bg-yellow-100/50 border-yellow-300 text-yellow-700 shadow-sm shadow-yellow-200/50';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'confirmed': return 'ખાતરી';
    case 'disputed': return 'વિવાદ';
    case 'resolved': return 'ઉકેલાયેલ';
    default: return 'બાકી';
  }
}

export default function HandoversReviewPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  
  // Dialog targets
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [disputeTarget, setDisputeTarget] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  
  // Dialog state
  const [disputeNote, setDisputeNote] = useState('');
  const [disputeNoteErr, setDisputeNoteErr] = useState('');
  const [expanded, setExpanded] = useState({});

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const queryKey = ['handovers', 'admin', filter];

  const { data: handovers, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => getHandovers(activeFilter.params),
  });

  // Helper for optimistic updates
  const updateCache = (id, updates) => {
    const previousData = queryClient.getQueryData(queryKey);
    if (previousData) {
      queryClient.setQueryData(queryKey, previousData.map(h => 
        (h.id === id || h._id === id) ? { ...h, ...updates } : h
      ));
    }
    return previousData;
  };

  const rollbackCache = (previousData) => {
    if (previousData) queryClient.setQueryData(queryKey, previousData);
  };

  const finalizeUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['handovers'] });
  };

  const confirmMut = useMutation({
    mutationFn: (id) => confirmHandover(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = updateCache(id, { status: 'confirmed' });
      setConfirmTarget(null);
      return { previousData };
    },
    onError: (err, id, context) => rollbackCache(context?.previousData),
    onSettled: finalizeUpdate,
  });

  const disputeMut = useMutation({
    mutationFn: ({ id, note }) => disputeHandover(id, note),
    onMutate: async ({ id, note }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = updateCache(id, { status: 'disputed', note });
      setDisputeTarget(null);
      setDisputeNote('');
      return { previousData };
    },
    onError: (err, vars, context) => rollbackCache(context?.previousData),
    onSettled: finalizeUpdate,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, note }) => resolveHandover(id, note),
    onMutate: async ({ id, note }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = updateCache(id, { status: 'resolved' }); // Note append is tricky to optimistic update precisely, just change status locally
      setResolveTarget(null);
      setDisputeNote('');
      return { previousData };
    },
    onError: (err, vars, context) => rollbackCache(context?.previousData),
    onSettled: finalizeUpdate,
  });

  const handleDisputeSubmit = () => {
    if (!disputeNote.trim()) { setDisputeNoteErr('નોંધ જરૂરી છે'); return; }
    setDisputeNoteErr('');
    const hid = disputeTarget?.id || disputeTarget?._id;
    disputeMut.mutate({ id: hid, note: disputeNote.trim() });
  };

  const handleResolveSubmit = () => {
    if (!disputeNote.trim()) { setDisputeNoteErr('નોંધ જરૂરી છે'); return; }
    setDisputeNoteErr('');
    const hid = resolveTarget?.id || resolveTarget?._id;
    resolveMut.mutate({ id: hid, note: disputeNote.trim() });
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const list = handovers || [];
  const pendingCount = list.filter((h) => h.status === 'submitted').length;
  const confirmedTotal = sumPaise(list.filter((h) => h.status === 'confirmed').map((h) => h.receivedTotal));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">હેન્ડઓવર સમીક્ષા (Handovers)</h1>
        {isFetching && <div className="text-sm font-medium text-brand animate-pulse">Updating...</div>}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card text-center border-l-4 border-l-yellow-500">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">સમીક્ષા બાકી (Pending)</div>
          <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
        </div>
        <div className="card text-center border-l-4 border-l-green-500">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">ખાતરી થયેલ રકમ</div>
          <div className="text-2xl font-bold text-green-700">{inr(confirmedTotal)}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip whitespace-nowrap ${filter === f.key ? 'bg-gradient-to-r from-brand to-brand-dark text-white border-transparent shadow-md shadow-brand/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
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
        <div className="space-y-4">
          {list.map((h) => {
            const hid = h.id || h._id;
            const subAdminName = typeof h.subAdmin === 'object' ? h.subAdmin?.name : (h.submittedBy?.name || h.subAdmin || '—');
            const slipCount = h.slipCount || (h.slips?.length || 0);
            const hasVariance = h.variance !== 0 && h.variance != null;
            
            // Calculate progress for variance bar
            const expected = h.expectedTotal || 0;
            const received = h.receivedTotal || 0;
            const percentage = expected > 0 ? Math.min(100, Math.max(0, (received / expected) * 100)) : 100;
            const isShort = received < expected;
            const barColor = isShort ? 'bg-red-500' : (received > expected ? 'bg-blue-500' : 'bg-green-500');

            return (
              <div key={hid} className="card transition-all duration-300 hover:shadow-lg border-l-4 hover:-translate-y-0.5">
                <div className="flex items-start justify-between mb-4 border-b border-gray-100 pb-3">
                  <div>
                    <div className="font-black text-lg text-gray-900">{subAdminName}</div>
                    <div className="text-xs font-semibold text-gray-400 tracking-wide uppercase mt-0.5">
                      {new Date(h.createdAt).toLocaleDateString('gu-IN')} <span className="mx-1">•</span> {slipCount} સ્લિપ
                    </div>
                  </div>
                  <span className={`chip px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusChipClass(h.status)}`}>
                    {statusLabel(h.status)}
                  </span>
                </div>

                {/* Variance Visual Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    <span>Received: {inr(received)}</span>
                    <span>Expected: {inr(expected)}</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>

                {/* Amounts */}
                <div className="grid grid-cols-3 gap-2 text-sm mb-4">
                  <div className="bg-gray-50 p-2 rounded-lg text-center">
                    <div className="text-gray-400 font-medium uppercase text-[10px] tracking-wider mb-0.5">અપેક્ષિત</div>
                    <div className="font-semibold text-gray-800">{inr(h.expectedTotal)}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded-lg text-center">
                    <div className="text-gray-400 font-medium uppercase text-[10px] tracking-wider mb-0.5">પ્રાપ્ત</div>
                    <div className="font-semibold text-gray-800">{inr(h.receivedTotal)}</div>
                  </div>
                  <div className={`p-2 rounded-lg text-center ${hasVariance ? 'bg-red-50/50' : 'bg-green-50/50'}`}>
                    <div className="text-gray-400 font-medium uppercase text-[10px] tracking-wider mb-0.5">તફાવત</div>
                    <div className={`font-black ${hasVariance ? 'text-red-600' : 'text-green-600'}`}>
                      {inr(h.variance || 0)}
                    </div>
                  </div>
                </div>

                {h.note && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 flex items-start gap-2 mb-4">
                    <span className="text-gray-400 mt-0.5">📝</span>
                    <div>
                      <span className="font-bold block text-xs uppercase tracking-wider text-gray-500 mb-0.5">નોંધ (Note)</span>
                      {h.note}
                    </div>
                  </div>
                )}

                {/* Expandable Slip List */}
                {h.slips && h.slips.length > 0 && (
                  <div className="mb-2 border border-gray-100 rounded-xl overflow-hidden">
                    <button
                      className="w-full text-left text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors p-3 flex justify-between items-center"
                      onClick={() => toggleExpand(hid)}
                    >
                      <span>{expanded[hid] ? 'સ્લિપ છુપાવો' : 'સ્લિપ જુઓ (View Slips)'}</span>
                      <span className="text-gray-400">{expanded[hid] ? '▲' : '▼'}</span>
                    </button>
                    
                    {expanded[hid] && (
                      <div className="p-3 bg-white border-t border-gray-100">
                        {/* Fixed height scrollable container so huge handovers don't break the page */}
                        <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-gray-200">
                          {h.slips.map((slip, i) => {
                            const sname = slip.donor?.name || slip.donorName || (slip.isAnonymous ? t.anonymous : '—');
                            return (
                              <div key={slip.slipId || slip.id || slip._id || i} className="bg-gray-50/80 rounded-md p-2 text-sm flex items-center justify-between border border-gray-100/50">
                                <div className="truncate pr-2">
                                  <span className="font-bold text-gray-700 text-xs mr-2">{slip.slipId || `#${i + 1}`}</span>
                                  <span className="text-gray-600">{sname}</span>
                                </div>
                                <span className="font-bold text-gray-800 whitespace-nowrap">{inr(slip.amount)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-100">
                  {h.status === 'submitted' && (
                    <>
                      <button className="btn-primary py-2 px-4 text-sm shadow-md" onClick={() => setConfirmTarget(h)}>
                        ✓ ખાતરી કરો
                      </button>
                      <button
                        className="btn-danger py-2 px-4 text-sm shadow-md"
                        onClick={() => { setDisputeTarget(h); setDisputeNote(''); setDisputeNoteErr(''); }}
                      >
                        ✕ વિવાદ (Dispute)
                      </button>
                    </>
                  )}
                  {h.status === 'disputed' && (
                    <button
                      className="btn-primary py-2 px-4 text-sm shadow-md bg-blue-600 hover:bg-blue-700"
                      onClick={() => { setResolveTarget(h); setDisputeNote(''); setDisputeNoteErr(''); }}
                    >
                      ઉકેલો (Resolve)
                    </button>
                  )}
                </div>
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
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
              <div><span className="text-gray-500 font-medium text-sm">અપેક્ષિત:</span> <span className="font-bold text-gray-900">{inr(confirmTarget.expectedTotal)}</span></div>
              <div><span className="text-gray-500 font-medium text-sm">પ્રાપ્ત:</span> <span className="font-bold text-gray-900">{inr(confirmTarget.receivedTotal)}</span></div>
              <div className={confirmTarget.variance !== 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
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
              <div className="mb-3 text-sm bg-red-50 p-3 rounded-lg border border-red-100">
                <span className="font-medium text-red-800">અપેક્ષિત: {inr(disputeTarget.expectedTotal)}</span> <br/>
                <span className="font-medium text-red-800">પ્રાપ્ત: {inr(disputeTarget.receivedTotal)}</span>
              </div>
              <label className="label">વિવાદ નોંધ (Note) *</label>
              <textarea
                className="input bg-white"
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

      {/* Resolve Dialog */}
      <ConfirmDialog
        open={!!resolveTarget}
        title="હેન્ડઓવર ઉકેલો (Resolve Dispute)"
        message={`${typeof resolveTarget?.subAdmin === 'object' ? resolveTarget?.subAdmin?.name : (resolveTarget?.submittedBy?.name || '')} ના હેન્ડઓવર`}
        detail={
          resolveTarget && (
            <div>
              <div className="mb-3 text-sm bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="font-bold text-blue-900 mb-1">Previous Note:</div>
                <div className="text-blue-800">{resolveTarget.note}</div>
              </div>
              <label className="label">ઉકેલ નોંધ (Resolution Note) *</label>
              <textarea
                className="input bg-white"
                rows={3}
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="How was this resolved? (e.g., Shortage recovered from sub-admin)"
              />
              <FieldError>{disputeNoteErr}</FieldError>
            </div>
          )
        }
        confirmLabel="ઉકેલો (Resolve)"
        onConfirm={handleResolveSubmit}
        onCancel={() => { setResolveTarget(null); setDisputeNote(''); }}
        busy={resolveMut.isPending}
      />
    </div>
  );
}
