import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmSlip, getSlips, voidSlip } from '../../api/resources';
import ConfirmDialog from '../../components/ConfirmDialog';
import Receipt from '../../components/Receipt';
import { EmptyState, ErrorState, FieldError, Loading } from '../../components/States';
import { formatRupees, sumPaise } from '../../lib/clientMoney';
import { t } from '../../lib/i18n';

const FILTERS = [
  { key: 'all', label: 'All', params: {} },
  { key: 'active', label: 'Active', params: { status: 'active' } },
  { key: 'unconfirmed', label: 'Unconfirmed', params: { status: 'active', paymentConfirmed: 'false' } },
  { key: 'void', label: 'Void', params: { status: 'void' } },
];

function slipKey(slip) { return slip.slipId || slip.id || slip._id; }
function donorName(slip) { return slip.isAnonymous ? t.anonymous : slip.donor?.name || slip.donorName || '-'; }
function donorVillage(slip) { return slip.donor?.village || slip.village || ''; }
function schemeName(slip) { return slip.scheme?.name || slip.schemeName || ''; }
function receiptProps(slip) {
  return {
    slipId: slip.slipId || slipKey(slip),
    amount: slip.amount,
    scheme: schemeName(slip),
    donorName: donorName(slip),
    donorMobile: slip.donor?.mobile || slip.mobile || '',
    village: donorVillage(slip),
    paymentMode: slip.paymentMode,
    paymentConfirmed: slip.paymentConfirmed,
    date: slip.issuedAt || slip.createdAt,
  };
}
function simpleWhatsappUrl(slip) {
  const mobile = String(slip.donor?.mobile || slip.mobile || '').replace(/\D/g, '');
  const phone = mobile.length === 10 ? `91${mobile}` : mobile.length >= 11 && mobile.length <= 15 ? mobile : '';
  const text = [
    `Slip: ${slip.slipId || slipKey(slip)}`,
    `Name: ${donorName(slip)}`,
    `Amount: ${formatRupees(slip.amount)}`,
    `Status: ${slip.paymentConfirmed ? t.paymentConfirmed : t.paymentUnconfirmed}`,
  ].join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export default function SlipsReviewPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidReasonErr, setVoidReasonErr] = useState('');

  const activeFilter = FILTERS.find((item) => item.key === filter) || FILTERS[0];
  const queryKey = ['slips', 'admin', filter, page];

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => getSlips({ ...activeFilter.params, page, limit: 20 }),
    keepPreviousData: true,
  });

  // Optimistic Updates for Confirm Slip
  const confirmMut = useMutation({
    mutationFn: (id) => confirmSlip(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      
      // Optimistically update the cache
      if (previousData?.slips) {
        queryClient.setQueryData(queryKey, {
          ...previousData,
          slips: previousData.slips.map((slip) => 
            slipKey(slip) === id ? { ...slip, paymentConfirmed: true } : slip
          ),
        });
      }
      setConfirmTarget(null);
      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['slips', 'admin', filter] });
    },
  });

  // Optimistic Updates for Void Slip
  const voidMut = useMutation({
    mutationFn: ({ id, reason }) => voidSlip(id, reason),
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);
      
      if (previousData?.slips) {
        queryClient.setQueryData(queryKey, {
          ...previousData,
          slips: previousData.slips.map((slip) => 
            slipKey(slip) === id ? { ...slip, status: 'void', voidReason: reason } : slip
          ),
        });
      }
      setVoidTarget(null);
      setVoidReason('');
      return { previousData };
    },
    onError: (err, vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['slips', 'admin', filter] });
    },
  });

  const handleVoidSubmit = () => {
    if (!voidReason.trim()) { setVoidReasonErr('Reason is required.'); return; }
    setVoidReasonErr('');
    voidMut.mutate({ id: slipKey(voidTarget), reason: voidReason.trim() });
  };

  const handleFilterChange = (key) => {
    setFilter(key);
    setPage(1); // Reset page on filter change
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  // Support both paginated response {slips, total, pages} and raw array fallback
  const list = Array.isArray(data) ? data : (data?.slips || []);
  const total = data?.total || list.length;
  const totalPages = data?.pages || 1;

  // The summary stats at the top reflect the CURRENT PAGE only, 
  // since a full table scan on the client is what we are trying to avoid!
  const activeSlips = list.filter((slip) => slip.status === 'active');
  const confirmedAmount = sumPaise(activeSlips.filter((slip) => slip.paymentConfirmed).map((slip) => slip.amount));
  const unconfirmedCount = activeSlips.filter((slip) => !slip.paymentConfirmed).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-black tracking-tight text-gray-900">Slip Review</h1>
        {isFetching && <div className="text-sm font-medium text-brand animate-pulse">Updating...</div>}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card text-center border-l-4 border-l-blue-500">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Page Active Slips</div>
          <div className="text-2xl font-bold text-gray-900">{activeSlips.length}</div>
        </div>
        <div className="card text-center border-l-4 border-l-green-500">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Page Confirmed Amt</div>
          <div className="text-2xl font-bold text-green-700">{formatRupees(confirmedAmount)}</div>
        </div>
        <div className="card text-center border-l-4 border-l-orange-500">
          <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Page Unconfirmed</div>
          <div className="text-2xl font-bold text-orange-600">{unconfirmedCount}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            className={`chip whitespace-nowrap ${filter === item.key ? 'bg-gradient-to-r from-brand to-brand-dark text-white border-transparent shadow-md shadow-brand/20' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            type="button"
            onClick={() => handleFilterChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={t.noData} hint="No slips match this filter on this page." />
      ) : (
        <div className="space-y-4">
          {list.map((slip) => {
            const sid = slipKey(slip);
            return (
              <div key={sid} className="card transition-all duration-300 hover:shadow-lg border-l-4 hover:border-l-brand hover:-translate-y-0.5">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-b border-gray-100 pb-3">
                  <div>
                    <span className="font-black text-brand tracking-tight">{t.slipNo}: {slip.slipId || sid}</span>
                    {slip.bookNumber && <span className="ml-2 text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">#{slip.bookNumber}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`chip px-3 py-1 text-xs font-bold uppercase tracking-wider ${slip.status === 'active' ? 'bg-green-100/50 border-green-200 text-green-700' : 'bg-red-100/50 border-red-200 text-red-700'}`}>
                      {slip.status === 'active' ? 'Active' : 'Void'}
                    </span>
                    {slip.status === 'active' && (
                      <span className={`chip px-3 py-1 text-xs font-bold uppercase tracking-wider ${slip.paymentConfirmed ? 'bg-green-100/50 border-green-200 text-green-700' : 'bg-yellow-100/50 border-yellow-300 text-yellow-700 shadow-sm shadow-yellow-200/50'}`}>
                        {slip.paymentConfirmed ? t.paymentConfirmed : 'Unconfirmed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><span className="text-gray-400 font-medium uppercase text-xs tracking-wider">{t.name}:</span> <div className="font-semibold text-gray-800">{donorName(slip)}</div></div>
                  <div><span className="text-gray-400 font-medium uppercase text-xs tracking-wider">{t.village}:</span> <div className="font-semibold text-gray-800">{donorVillage(slip) || '-'}</div></div>
                  <div><span className="text-gray-400 font-medium uppercase text-xs tracking-wider">{t.amount}:</span> <div className="font-black text-brand text-lg">{formatRupees(slip.amount)}</div></div>
                  <div><span className="text-gray-400 font-medium uppercase text-xs tracking-wider">Mode:</span> <div className="font-semibold text-gray-800 uppercase">{slip.paymentMode || '-'}</div></div>
                  {schemeName(slip) && <div><span className="text-gray-400 font-medium uppercase text-xs tracking-wider">{t.scheme}:</span> <div className="font-semibold text-gray-800 truncate">{schemeName(slip)}</div></div>}
                  <div><span className="text-gray-400 font-medium uppercase text-xs tracking-wider">Date:</span> <div className="font-semibold text-gray-800">{new Date(slip.issuedAt || slip.createdAt).toLocaleDateString('gu-IN')}</div></div>
                </div>

                {slip.receiptUrl && (
                  <div className="mt-4 bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <a href={slip.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 text-sm font-semibold text-brand hover:text-brand-dark transition-colors">
                      <img src={slip.receiptUrl} alt="receipt" className="h-12 w-12 rounded-md border border-gray-200 object-cover shadow-sm" />
                      View Uploaded Payment Receipt &rarr;
                    </a>
                  </div>
                )}

                {slip.status === 'void' && slip.voidReason && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-3 text-sm text-red-700 flex items-start gap-2">
                    <span className="text-red-500">⚠</span>
                    <div>
                      <span className="font-bold block text-xs uppercase tracking-wider mb-0.5">Void Reason</span>
                      {slip.voidReason}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <button className="btn-secondary px-4 py-2 text-sm shadow-sm" type="button" onClick={() => setReceiptTarget(slip)}>
                    Receipt / PDF
                  </button>
                  <a className="btn-secondary px-4 py-2 text-sm shadow-sm flex items-center gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 hover:border-green-200" href={simpleWhatsappUrl(slip)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                  {slip.status === 'active' && !slip.paymentConfirmed && (
                    <button className="btn-primary px-4 py-2 text-sm shadow-md" type="button" onClick={() => setConfirmTarget(slip)}>
                      Confirm payment
                    </button>
                  )}
                  {slip.status === 'active' && (
                    <button
                      className="btn-danger px-4 py-2 text-sm shadow-md"
                      type="button"
                      onClick={() => { setVoidTarget(slip); setVoidReason(''); setVoidReasonErr(''); }}
                    >
                      Void Slip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-gray-200 bg-white/50 backdrop-blur-sm px-4 py-3 sm:px-6 rounded-2xl shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing page <span className="font-medium text-brand">{page}</span> of <span className="font-medium">{totalPages}</span>
                <span className="ml-2 text-gray-400">({total} total records)</span>
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center rounded-l-md px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {receiptTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-lg w-full animate-in zoom-in-95 duration-200">
            <div className="mb-3 flex justify-end">
              <button className="btn-secondary px-4 py-2 text-sm rounded-full shadow-lg" type="button" onClick={() => setReceiptTarget(null)}>
                Close
              </button>
            </div>
            <Receipt {...receiptProps(receiptTarget)} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Confirm Payment"
        message={`${t.slipNo}: ${confirmTarget?.slipId || ''}`}
        detail={
          confirmTarget && (
            <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div><span className="text-gray-500 font-medium text-sm">{t.name}:</span> <span className="font-bold text-gray-900">{donorName(confirmTarget)}</span></div>
              <div><span className="text-gray-500 font-medium text-sm">{t.amount}:</span> <span className="font-bold text-green-700 text-lg">{formatRupees(confirmTarget.amount)}</span></div>
              <div><span className="text-gray-500 font-medium text-sm">Mode:</span> <span className="font-bold text-gray-900 uppercase">{confirmTarget.paymentMode}</span></div>
            </div>
          )
        }
        confirmLabel="Confirm payment"
        onConfirm={() => confirmMut.mutate(slipKey(confirmTarget))}
        onCancel={() => setConfirmTarget(null)}
        busy={confirmMut.isPending}
      />

      <ConfirmDialog
        open={!!voidTarget}
        title="Void Slip"
        message={`${t.slipNo}: ${voidTarget?.slipId || ''} - ${formatRupees(voidTarget?.amount)}`}
        danger
        detail={
          voidTarget && (
            <div className="mt-2">
              <label className="label" htmlFor="voidReason">Reason for Voiding *</label>
              <input id="voidReason" className="input bg-white" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="e.g. Duplicate entry, wrong amount" />
              <FieldError>{voidReasonErr}</FieldError>
            </div>
          )
        }
        confirmLabel="Void slip"
        onConfirm={handleVoidSubmit}
        onCancel={() => { setVoidTarget(null); setVoidReason(''); }}
        busy={voidMut.isPending}
      />
    </div>
  );
}
