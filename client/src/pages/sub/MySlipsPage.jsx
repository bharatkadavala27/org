import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSlips, voidSlip } from '../../api/resources';
import ConfirmDialog from '../../components/ConfirmDialog';
import Receipt from '../../components/Receipt';
import { EmptyState, ErrorState, FieldError, Loading } from '../../components/States';
import { formatRupees } from '../../lib/clientMoney';
import { t } from '../../lib/i18n';

function slipKey(slip) {
  return slip.slipId || slip.id || slip._id;
}
function donorName(slip) {
  return slip.isAnonymous ? t.anonymous : slip.donor?.name || slip.donorName || '-';
}
function receiptProps(slip) {
  return {
    slipId: slip.slipId || slipKey(slip),
    amount: slip.amount,
    scheme: slip.scheme?.name || slip.schemeName || '',
    donorName: donorName(slip),
    donorMobile: slip.donor?.mobile || slip.mobile || '',
    village: slip.donor?.village || slip.village || '',
    paymentMode: slip.paymentMode,
    paymentConfirmed: slip.paymentConfirmed,
    date: slip.issuedAt || slip.createdAt,
  };
}
function whatsappUrl(slip) {
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

export default function MySlipsPage() {
  const queryClient = useQueryClient();
  const [voidTarget, setVoidTarget] = useState(null);
  const [receiptTarget, setReceiptTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');

  const { data: slips, isLoading, error, refetch } = useQuery({
    queryKey: ['slips', 'mine'],
    queryFn: () => getSlips({}),
  });

  const voidMut = useMutation({
    mutationFn: ({ id, reason }) => voidSlip(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slips'] });
      setVoidTarget(null);
      setReason('');
    },
  });

  const handleVoid = () => {
    if (!reason.trim()) {
      setReasonErr('Reason is required.');
      return;
    }
    setReasonErr('');
    voidMut.mutate({ id: slipKey(voidTarget), reason: reason.trim() });
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const list = Array.isArray(slips) ? slips : (slips?.slips || []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">My Slips</h1>

      {list.length === 0 ? (
        <EmptyState title="No slips yet" hint="Create a new slip first." />
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
                    {slip.paymentConfirmed && (
                      <span className="chip px-2 py-0.5 text-xs bg-green-100 border-green-300 text-green-700">
                        {t.paymentConfirmed}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5 text-sm">
                  <div>{t.name}: {donorName(slip)}</div>
                  <div>{t.village}: {slip.donor?.village || slip.village || '-'}</div>
                  <div>{t.amount}: <span className="font-semibold">{formatRupees(slip.amount)}</span></div>
                  <div>Mode: {slip.paymentMode || '-'} {slip.scheme?.name || slip.schemeName ? `- ${slip.scheme?.name || slip.schemeName}` : ''}</div>
                  <div className="text-xs text-gray-500">{new Date(slip.issuedAt || slip.createdAt).toLocaleDateString('gu-IN')}</div>
                </div>

                {slip.status === 'void' && slip.voidReason && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                    Void reason: {slip.voidReason}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-secondary px-3 py-2 text-sm" type="button" onClick={() => setReceiptTarget(slip)}>
                    Receipt / PDF
                  </button>
                  <a className="btn-secondary px-3 py-2 text-sm" href={whatsappUrl(slip)} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                  {slip.status === 'active' && (
                    <button
                      className="btn-danger px-3 py-2 text-sm"
                      type="button"
                      onClick={() => { setVoidTarget(slip); setReason(''); setReasonErr(''); }}
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
        open={!!voidTarget}
        title="Void Slip"
        message={`${t.slipNo}: ${voidTarget?.slipId || ''} - ${formatRupees(voidTarget?.amount)}`}
        danger
        detail={
          <div>
            <label className="label" htmlFor="subVoidReason">Reason *</label>
            <input id="subVoidReason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Write the reason" />
            <FieldError>{reasonErr}</FieldError>
          </div>
        }
        confirmLabel="Void slip"
        onConfirm={handleVoid}
        onCancel={() => { setVoidTarget(null); setReason(''); }}
        busy={voidMut.isPending}
      />
    </div>
  );
}
