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
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [voidTarget, setVoidTarget] = useState(null);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidReasonErr, setVoidReasonErr] = useState('');

  const activeFilter = FILTERS.find((item) => item.key === filter) || FILTERS[0];
  const { data: slips, isLoading, error, refetch } = useQuery({
    queryKey: ['slips', 'admin', filter],
    queryFn: () => getSlips(activeFilter.params),
  });

  const confirmMut = useMutation({
    mutationFn: (id) => confirmSlip(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['slips'] }); setConfirmTarget(null); },
  });
  const voidMut = useMutation({
    mutationFn: ({ id, reason }) => voidSlip(id, reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['slips'] }); setVoidTarget(null); setVoidReason(''); },
  });

  const handleVoidSubmit = () => {
    if (!voidReason.trim()) { setVoidReasonErr('Reason is required.'); return; }
    setVoidReasonErr('');
    voidMut.mutate({ id: slipKey(voidTarget), reason: voidReason.trim() });
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const list = slips || [];
  const activeSlips = list.filter((slip) => slip.status === 'active');
  const confirmedAmount = sumPaise(activeSlips.filter((slip) => slip.paymentConfirmed).map((slip) => slip.amount));
  const unconfirmedCount = activeSlips.filter((slip) => !slip.paymentConfirmed).length;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">Slip Review</h1>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card text-center">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-xl font-bold">{activeSlips.length}</div>
        </div>
        <div className="card text-center">
          <div className="text-sm text-gray-500">Confirmed amount</div>
          <div className="text-xl font-bold text-green-700">{formatRupees(confirmedAmount)}</div>
        </div>
        <div className="card text-center">
          <div className="text-sm text-gray-500">Unconfirmed</div>
          <div className="text-xl font-bold text-orange-600">{unconfirmedCount}</div>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-3">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            className={`chip whitespace-nowrap ${filter === item.key ? 'bg-brand text-white border-brand' : 'bg-white border-gray-300 text-gray-700'}`}
            type="button"
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState title={t.noData} hint="No slips match this filter." />
      ) : (
        <div className="space-y-3">
          {list.map((slip) => {
            const sid = slipKey(slip);
            return (
              <div key={sid} className="card">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="font-bold text-brand">{t.slipNo}: {slip.slipId || sid}</span>
                    {slip.bookNumber && <span className="ml-2 text-xs text-gray-400">#{slip.bookNumber}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className={`chip px-2 py-0.5 text-xs ${slip.status === 'active' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-red-100 border-red-300 text-red-700'}`}>
                      {slip.status === 'active' ? 'Active' : 'Void'}
                    </span>
                    {slip.status === 'active' && (
                      <span className={`chip px-2 py-0.5 text-xs ${slip.paymentConfirmed ? 'bg-green-100 border-green-300 text-green-700' : 'bg-yellow-100 border-yellow-300 text-yellow-700'}`}>
                        {slip.paymentConfirmed ? t.paymentConfirmed : 'Unconfirmed'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div><span className="text-gray-500">{t.name}:</span> {donorName(slip)}</div>
                  <div><span className="text-gray-500">{t.village}:</span> {donorVillage(slip) || '-'}</div>
                  <div><span className="text-gray-500">{t.amount}:</span> <span className="font-semibold">{formatRupees(slip.amount)}</span></div>
                  <div><span className="text-gray-500">Mode:</span> {slip.paymentMode || '-'}</div>
                  {schemeName(slip) && <div><span className="text-gray-500">{t.scheme}:</span> {schemeName(slip)}</div>}
                  <div><span className="text-gray-500">Date:</span> {new Date(slip.issuedAt || slip.createdAt).toLocaleDateString('gu-IN')}</div>
                </div>

                {slip.receiptUrl && (
                  <div className="mt-2">
                    <a href={slip.receiptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand underline">
                      <img src={slip.receiptUrl} alt="receipt" className="h-10 w-10 rounded border object-cover" />
                      Uploaded payment receipt
                    </a>
                  </div>
                )}

                {slip.status === 'void' && slip.voidReason && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    <span className="font-medium">Void reason:</span> {slip.voidReason}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-secondary px-3 py-2 text-sm" type="button" onClick={() => setReceiptTarget(slip)}>
                    Receipt / PDF
                  </button>
                  <a className="btn-secondary px-3 py-2 text-sm" href={simpleWhatsappUrl(slip)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                  {slip.status === 'active' && !slip.paymentConfirmed && (
                    <button className="btn-primary px-3 py-2 text-sm" type="button" onClick={() => setConfirmTarget(slip)}>
                      Confirm payment
                    </button>
                  )}
                  {slip.status === 'active' && (
                    <button
                      className="btn-danger px-3 py-2 text-sm"
                      type="button"
                      onClick={() => { setVoidTarget(slip); setVoidReason(''); setVoidReasonErr(''); }}
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {receiptTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="mx-auto max-w-lg">
            <div className="mb-3 flex justify-end">
              <button className="btn-secondary px-3 py-2 text-sm" type="button" onClick={() => setReceiptTarget(null)}>
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
            <div className="space-y-1">
              <div>{t.name}: {donorName(confirmTarget)}</div>
              <div>{t.amount}: {formatRupees(confirmTarget.amount)}</div>
              <div>Mode: {confirmTarget.paymentMode}</div>
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
            <div>
              <label className="label" htmlFor="voidReason">Reason *</label>
              <input id="voidReason" className="input" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Write the reason" />
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
