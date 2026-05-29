import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveExpense,
  createExpense,
  getExpenses,
  getSchemes,
  rejectExpense,
  uploadFile,
} from '../../api/resources';
import { EmptyState, ErrorState, FieldError, Loading } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { inr, t } from '../../lib/i18n';
import { isValidAmount, round2, sumPaise, toPaise } from '../../lib/clientMoney';

const DEFAULT_CATEGORIES = ['Venue', 'Catering', 'Decoration', 'Gifts', 'Admin', 'Misc'];
const CURRENT_YEAR = new Date().getFullYear();

const emptyForm = {
  schemeId: '',
  year: CURRENT_YEAR,
  category: DEFAULT_CATEGORIES[0],
  customCategory: '',
  amount: '',
  gstRate: '',
  taxAmount: '',
  gstNumber: '',
  vendor: '',
  receiptUrl: '',
};

function taxPreview(form) {
  if (form.taxAmount !== '') return round2(form.taxAmount);
  const rate = Number(form.gstRate);
  if (!Number.isFinite(rate) || rate <= 0 || !isValidAmount(form.amount)) return 0;
  const taxPaise = Math.round((toPaise(form.amount) * rate) / 100);
  return round2(taxPaise / 100);
}

function selectedCategory(form) {
  return form.category === '__custom__' ? form.customCategory.trim() : form.category;
}

function statusChipClass(status) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 border-green-300 text-green-700';
    case 'rejected':
      return 'bg-red-100 border-red-300 text-red-700';
    default:
      return 'bg-yellow-100 border-yellow-300 text-yellow-700';
  }
}

function ReceiptThumb({ url }) {
  const [failed, setFailed] = useState(false);
  if (!url) return null;
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-brand underline">
      {isPdf || failed ? (
        <span className="flex h-12 w-12 items-center justify-center rounded border bg-gray-50 text-xs font-semibold text-gray-600">
          PDF
        </span>
      ) : (
        <img src={url} alt="Receipt" className="h-12 w-12 rounded border object-cover" onError={() => setFailed(true)} />
      )}
      Open receipt
    </a>
  );
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [receiptFile, setReceiptFile] = useState(null);
  const [status, setStatus] = useState('all');
  const [errors, setErrors] = useState({});
  const [actionError, setActionError] = useState('');
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  const schemes = schemesQ.data || [];

  useEffect(() => {
    if (!form.schemeId && schemes.length) {
      setForm((prev) => ({ ...prev, schemeId: schemes[0].id }));
    }
  }, [form.schemeId, schemes]);

  const params = {
    schemeId: form.schemeId || undefined,
    year: form.year || CURRENT_YEAR,
    ...(status === 'all' ? {} : { status }),
  };

  const expensesQ = useQuery({
    queryKey: ['expenses', params],
    queryFn: () => getExpenses(params),
    enabled: Boolean(form.schemeId),
  });

  const createMut = useMutation({
    mutationFn: (body) => createExpense(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['budgetVariance'] });
      setForm((prev) => ({ ...emptyForm, schemeId: prev.schemeId, year: prev.year }));
      setReceiptFile(null);
      setErrors({});
    },
  });

  const approveMut = useMutation({
    mutationFn: (id) => approveExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['budgetVariance'] });
      setApproveTarget(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }) => rejectExpense(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['budgetVariance'] });
      setRejectTarget(null);
      setRejectReason('');
    },
  });

  const expenses = expensesQ.data || [];
  const categoryOptions = useMemo(() => {
    const existing = expenses.map((expense) => expense.category).filter(Boolean);
    return [...new Set([...DEFAULT_CATEGORIES, ...existing])];
  }, [expenses]);

  const previewTax = taxPreview(form);
  const previewTotal = sumPaise([form.amount || 0, previewTax]);
  const approvedTotal = sumPaise(expenses.filter((expense) => expense.status === 'approved').map((expense) => expense.totalAmount));
  const submittedCount = expenses.filter((expense) => expense.status === 'submitted').length;

  const validate = () => {
    const nextErrors = {};
    if (!form.schemeId) nextErrors.schemeId = 'Select a scheme.';
    if (!selectedCategory(form)) nextErrors.category = 'Enter a category.';
    if (!isValidAmount(form.amount)) nextErrors.amount = 'Amount must be greater than 0.';
    if (form.taxAmount !== '' && Number(form.taxAmount) < 0) nextErrors.taxAmount = 'GST/tax cannot be negative.';
    if (form.gstRate !== '' && (Number(form.gstRate) < 0 || Number(form.gstRate) > 100)) {
      nextErrors.gstRate = 'GST/tax rate must be between 0 and 100.';
    }
    if (!receiptFile && !form.receiptUrl.trim()) nextErrors.receipt = 'Receipt is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setActionError('');
    if (!validate()) return;

    try {
      let receiptUrl = form.receiptUrl.trim();
      if (receiptFile) {
        const uploaded = await uploadFile(receiptFile, 'receipts');
        receiptUrl = uploaded.url;
      }
      await createMut.mutateAsync({
        schemeId: form.schemeId,
        year: Number(form.year),
        category: selectedCategory(form),
        amount: round2(form.amount),
        gstRate: form.taxAmount === '' ? form.gstRate || undefined : undefined,
        taxAmount: form.taxAmount === '' ? undefined : round2(form.taxAmount),
        gstNumber: form.gstNumber.trim() || undefined,
        vendor: form.vendor.trim() || undefined,
        receiptUrl,
      });
    } catch (err) {
      setErrors((prev) => ({ ...prev, submit: err.message || 'Could not submit expense.' }));
    }
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setActionError('');
    try {
      await approveMut.mutateAsync(approveTarget.id);
    } catch (err) {
      setActionError(err.message || 'Could not approve expense.');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }
    setActionError('');
    try {
      await rejectMut.mutateAsync({ id: rejectTarget.id, reason: rejectReason.trim() });
    } catch (err) {
      setActionError(err.message || 'Could not reject expense.');
    }
  };

  if (schemesQ.isLoading) return <Loading />;
  if (schemesQ.error) return <ErrorState error={schemesQ.error} onRetry={schemesQ.refetch} />;
  if (!schemes.length) return <EmptyState title="No active schemes" hint="Create a scheme before entering expenses." />;

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t.expensesTitle}</h1>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="card">
          <div className="text-sm text-gray-500">Approved actual</div>
          <div className="mt-1 text-2xl font-bold text-green-700">{inr(approvedTotal)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Pending approval</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">{submittedCount}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Visible expenses</div>
          <div className="mt-1 text-2xl font-bold">{expenses.length}</div>
        </div>
      </div>

      <div className="card mb-5">
        <form className="grid gap-3 lg:grid-cols-4" onSubmit={handleSubmit}>
          <div>
            <label className="label">{t.scheme}</label>
            <select className="input" value={form.schemeId} onChange={(e) => setForm({ ...form, schemeId: e.target.value })}>
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
              ))}
            </select>
            <FieldError>{errors.schemeId}</FieldError>
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          </div>
          <div>
            <label className="label">{t.category}</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
            <FieldError>{errors.category}</FieldError>
          </div>
          {form.category === '__custom__' && (
            <div>
              <label className="label">Custom category</label>
              <input className="input" value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label">Base amount</label>
            <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <FieldError>{errors.amount}</FieldError>
          </div>
          <div>
            <label className="label">GST/tax rate %</label>
            <input className="input" type="number" min="0" max="100" step="0.01" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} />
            <FieldError>{errors.gstRate}</FieldError>
          </div>
          <div>
            <label className="label">GST/tax amount</label>
            <input className="input" type="number" min="0" step="0.01" value={form.taxAmount} onChange={(e) => setForm({ ...form, taxAmount: e.target.value })} />
            <FieldError>{errors.taxAmount}</FieldError>
          </div>
          <div>
            <label className="label">GST number</label>
            <input className="input" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
          </div>
          <div>
            <label className="label">{t.vendor}</label>
            <input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
          </div>
          <div>
            <label className="label">Upload receipt</label>
            <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="label">Receipt URL</label>
            <input className="input" value={form.receiptUrl} onChange={(e) => setForm({ ...form, receiptUrl: e.target.value })} />
            <FieldError>{errors.receipt}</FieldError>
          </div>
          <div className="flex flex-col justify-end">
            <div className="mb-2 text-sm text-gray-600">
              Tax {inr(previewTax)} - Total <span className="font-semibold">{inr(previewTotal)}</span>
            </div>
            <button className="btn-primary" type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? t.loading : t.submit}
            </button>
          </div>
          <div className="lg:col-span-4">
            <FieldError>{errors.submit}</FieldError>
          </div>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['all', 'submitted', 'approved', 'rejected'].map((key) => (
          <button
            key={key}
            className={`chip text-sm ${status === key ? 'bg-brand text-white border-brand' : 'bg-white border-gray-300 text-gray-700'}`}
            onClick={() => setStatus(key)}
          >
            {key[0].toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {expensesQ.isLoading ? (
        <Loading />
      ) : expensesQ.error ? (
        <ErrorState error={expensesQ.error} onRetry={expensesQ.refetch} />
      ) : expenses.length === 0 ? (
        <EmptyState title="No expenses found" />
      ) : (
        <div className="space-y-3">
          {expenses.map((expense) => (
            <div key={expense.id} className="card">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-bold">{expense.category}</div>
                  <div className="text-sm text-gray-500">
                    {expense.scheme?.name || expense.scheme} - {expense.year} - {expense.vendor || 'No vendor'}
                  </div>
                </div>
                <span className={`chip text-xs py-1 px-2 ${statusChipClass(expense.status)}`}>
                  {expense.status}
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                <div><span className="text-gray-500">Base:</span> <span className="font-semibold">{inr(expense.amount)}</span></div>
                <div><span className="text-gray-500">GST/tax:</span> <span className="font-semibold">{inr(expense.taxAmount)}</span></div>
                <div><span className="text-gray-500">Total:</span> <span className="font-semibold">{inr(expense.totalAmount)}</span></div>
                <div><span className="text-gray-500">Submitted:</span> {expense.submittedBy?.name || 'Office'}</div>
              </div>
              {expense.gstNumber && <div className="mt-2 text-sm text-gray-600">GST: {expense.gstNumber}</div>}
              {expense.rejectReason && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                  <span className="font-medium">Rejected reason:</span> {expense.rejectReason}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ReceiptThumb url={expense.receiptUrl} />
                {expense.status === 'submitted' && (
                  <div className="flex gap-2">
                    <button className="btn-primary py-2 px-3 text-sm" onClick={() => setApproveTarget(expense)}>
                      {t.approve}
                    </button>
                    <button
                      className="btn-danger py-2 px-3 text-sm"
                      onClick={() => {
                        setRejectTarget(expense);
                        setRejectReason('');
                        setActionError('');
                      }}
                    >
                      {t.reject}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!approveTarget}
        title="Approve expense"
        message={approveTarget ? `${approveTarget.category} - ${inr(approveTarget.totalAmount)}` : ''}
        detail={approveTarget && <ReceiptThumb url={approveTarget.receiptUrl} />}
        confirmLabel={t.approve}
        onConfirm={handleApprove}
        onCancel={() => setApproveTarget(null)}
        busy={approveMut.isPending}
      />

      <ConfirmDialog
        open={!!rejectTarget}
        title="Reject expense"
        message={rejectTarget ? `${rejectTarget.category} - ${inr(rejectTarget.totalAmount)}` : ''}
        danger
        detail={
          <div>
            <label className="label">{t.reason} *</label>
            <textarea className="input" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <FieldError>{actionError}</FieldError>
          </div>
        }
        confirmLabel={t.reject}
        onConfirm={handleReject}
        onCancel={() => setRejectTarget(null)}
        busy={rejectMut.isPending}
      />
    </div>
  );
}
