import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBudgetVariance, getBudgets, getSchemes, saveBudget } from '../../api/resources';
import { EmptyState, ErrorState, FieldError, Loading } from '../../components/States';
import { inr, t } from '../../lib/i18n';
import { round2, sumPaise } from '../../lib/clientMoney';

const DEFAULT_CATEGORIES = ['Venue', 'Catering', 'Decoration', 'Gifts', 'Admin', 'Misc'];
const CURRENT_YEAR = new Date().getFullYear();

const emptyForm = {
  category: DEFAULT_CATEGORIES[0],
  customCategory: '',
  plannedAmount: '',
};

function selectedCategory(form) {
  return form.category === '__custom__' ? form.customCategory.trim() : form.category;
}

function statusClass(status) {
  switch (status) {
    case 'over':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'under':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [schemeId, setSchemeId] = useState('');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  const schemes = schemesQ.data || [];

  useEffect(() => {
    if (!schemeId && schemes.length) setSchemeId(schemes[0].id);
  }, [schemeId, schemes]);

  const budgetsQ = useQuery({
    queryKey: ['budgets', schemeId, year],
    queryFn: () => getBudgets({ schemeId, year }),
    enabled: Boolean(schemeId),
  });

  const varianceQ = useQuery({
    queryKey: ['budgetVariance', schemeId, year],
    queryFn: () => getBudgetVariance({ schemeId, year }),
    enabled: Boolean(schemeId),
  });

  const saveMut = useMutation({
    mutationFn: (body) => saveBudget(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgetVariance'] });
      setForm(emptyForm);
      setErrors({});
    },
  });

  const budgets = budgetsQ.data || [];
  const variance = varianceQ.data;
  const rows = variance?.rows || [];
  const categoryOptions = useMemo(() => {
    const existing = [...budgets.map((budget) => budget.category), ...rows.map((row) => row.category)].filter(Boolean);
    return [...new Set([...DEFAULT_CATEGORIES, ...existing])];
  }, [budgets, rows]);

  const validate = () => {
    const nextErrors = {};
    if (!schemeId) nextErrors.schemeId = 'Select a scheme.';
    if (!selectedCategory(form)) nextErrors.category = 'Enter a category.';
    const planned = Number(form.plannedAmount);
    if (!Number.isFinite(planned) || planned < 0) nextErrors.plannedAmount = 'Planned amount must be 0 or more.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    try {
      await saveMut.mutateAsync({
        schemeId,
        year: Number(year),
        category: selectedCategory(form),
        plannedAmount: round2(form.plannedAmount),
      });
    } catch (err) {
      setErrors((prev) => ({ ...prev, submit: err.message || 'Could not save budget.' }));
    }
  };

  const editBudget = (budget) => {
    const known = DEFAULT_CATEGORIES.includes(budget.category);
    setForm({
      category: known ? budget.category : '__custom__',
      customCategory: known ? '' : budget.category,
      plannedAmount: String(budget.plannedAmount ?? ''),
    });
    setErrors({});
  };

  if (schemesQ.isLoading) return <Loading />;
  if (schemesQ.error) return <ErrorState error={schemesQ.error} onRetry={schemesQ.refetch} />;
  if (!schemes.length) return <EmptyState title="No active schemes" hint="Create a scheme before setting budgets." />;

  const plannedTotal = variance?.totals?.plannedAmount ?? sumPaise(budgets.map((budget) => budget.plannedAmount));
  const actualTotal = variance?.totals?.actualAmount ?? 0;
  const varianceTotal = variance?.totals?.variance ?? sumPaise([plannedTotal, -actualTotal]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{t.budgetsTitle}</h1>

      <div className="card mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t.scheme}</label>
            <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>{scheme.name}</option>
              ))}
            </select>
            <FieldError>{errors.schemeId}</FieldError>
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input" type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>

        <form className="mt-4 grid gap-3 lg:grid-cols-4" onSubmit={handleSubmit}>
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
            <label className="label">{t.planned}</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.plannedAmount}
              onChange={(e) => setForm({ ...form, plannedAmount: e.target.value })}
            />
            <FieldError>{errors.plannedAmount}</FieldError>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit" disabled={saveMut.isPending}>
              {saveMut.isPending ? t.loading : t.save}
            </button>
          </div>
          <div className="lg:col-span-4">
            <FieldError>{errors.submit}</FieldError>
          </div>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <div className="card">
          <div className="text-sm text-gray-500">{t.planned}</div>
          <div className="mt-1 text-2xl font-bold">{inr(plannedTotal)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Approved actual</div>
          <div className="mt-1 text-2xl font-bold">{inr(actualTotal)}</div>
        </div>
        <div className={`card border ${varianceTotal < 0 ? 'border-red-200 bg-red-50' : varianceTotal > 0 ? 'border-green-200 bg-green-50' : ''}`}>
          <div className="text-sm text-gray-500">{t.variance}</div>
          <div className={`mt-1 text-2xl font-bold ${varianceTotal < 0 ? 'text-red-700' : varianceTotal > 0 ? 'text-green-700' : ''}`}>
            {inr(varianceTotal)}
          </div>
        </div>
      </div>

      {budgetsQ.isLoading || varianceQ.isLoading ? (
        <Loading />
      ) : budgetsQ.error ? (
        <ErrorState error={budgetsQ.error} onRetry={budgetsQ.refetch} />
      ) : varianceQ.error ? (
        <ErrorState error={varianceQ.error} onRetry={varianceQ.refetch} />
      ) : rows.length === 0 ? (
        <EmptyState title="No budgets or approved expenses" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">{t.category}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.planned}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.actual}</th>
                <th className="px-3 py-2 text-right font-semibold">{t.variance}</th>
                <th className="px-3 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => {
                const budget = budgets.find((item) => item.category === row.category) || row;
                return (
                  <tr key={row.category}>
                    <td className="px-3 py-2 font-medium">{row.category}</td>
                    <td className="px-3 py-2 text-right">{inr(row.plannedAmount)}</td>
                    <td className="px-3 py-2 text-right">{inr(row.actualAmount)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                        {inr(row.variance)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="btn-secondary py-2 px-3 text-sm" onClick={() => editBudget(budget)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
