import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUpiSettings, saveUpiSettings } from '../../api/resources';
import { Loading, ErrorState, FieldError } from '../../components/States';
import { t } from '../../lib/i18n';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ payeeVpa: '', payeeName: '', defaultNote: '' });
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['upiSettings'],
    queryFn: getUpiSettings,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        payeeVpa: settings.payeeVpa || '',
        payeeName: settings.payeeName || '',
        defaultNote: settings.defaultNote || '',
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: (body) => saveUpiSettings(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upiSettings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const validate = () => {
    const e = {};
    if (!form.payeeVpa.trim()) e.payeeVpa = 'UPI ID જરૂરી છે';
    else if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(form.payeeVpa.trim()))
      e.payeeVpa = 'માન્ય UPI ID દાખલ કરો (દા.ત. trust@upi)';
    if (!form.payeeName.trim()) e.payeeName = 'ટ્રસ્ટ નામ જરૂરી છે';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await saveMut.mutateAsync({
        payeeVpa: form.payeeVpa.trim(),
        payeeName: form.payeeName.trim(),
        defaultNote: form.defaultNote.trim() || undefined,
      });
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold mb-4">UPI સેટિંગ્સ (Settings)</h1>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-300 rounded-lg p-3 flex items-center gap-2 text-green-700">
          <span className="font-medium">સેટિંગ્સ સાચવ્યા!</span>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">UPI ID (VPA) *</label>
            <input className="input" value={form.payeeVpa} onChange={(e) => setForm({ ...form, payeeVpa: e.target.value })} placeholder="trust@upi" />
            <FieldError>{errors.payeeVpa}</FieldError>
          </div>
          <div>
            <label className="label">ટ્રસ્ટ નામ (Payee Name) *</label>
            <input className="input" value={form.payeeName} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} placeholder={t.appName} />
            <FieldError>{errors.payeeName}</FieldError>
          </div>
          <div>
            <label className="label">ડિફોલ્ટ નોંધ (Default Note)</label>
            <input className="input" value={form.defaultNote} onChange={(e) => setForm({ ...form, defaultNote: e.target.value })} placeholder="દાન" />
          </div>
          <FieldError>{errors.submit}</FieldError>
          <button className="btn-primary w-full" type="submit" disabled={saveMut.isPending}>
            {saveMut.isPending ? t.loading : t.save}
          </button>
        </form>
      </div>

      {settings && settings.payeeVpa && (
        <div className="card mt-4">
          <h2 className="font-bold text-sm text-gray-500 mb-2">હાલની સેટિંગ્સ (Current)</h2>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">UPI ID: </span><span className="font-medium">{settings.payeeVpa}</span></div>
            <div><span className="text-gray-500">નામ: </span><span className="font-medium">{settings.payeeName}</span></div>
            {settings.defaultNote && (<div><span className="text-gray-500">નોંધ: </span><span className="font-medium">{settings.defaultNote}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}
