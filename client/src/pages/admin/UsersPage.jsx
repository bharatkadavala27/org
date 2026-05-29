import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser } from '../../api/resources';
import { Loading, EmptyState, ErrorState, FieldError } from '../../components/States';
import { t } from '../../lib/i18n';

const emptyForm = { name: '', phone: '', password: '', villages: '', status: 'active' };

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  });

  const createMut = useMutation({
    mutationFn: (body) => createUser(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => updateUser(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      resetForm();
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (user) => {
    const villageStr = (user.villages || []).map((v) =>
      typeof v === 'string' ? v : v.village || ''
    ).filter(Boolean).join(', ');
    setEditingId(user.id || user._id);
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      password: '',
      villages: villageStr,
      status: user.status || 'active',
    });
    setErrors({});
    setShowForm(true);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'નામ જરૂરી છે';
    if (!form.phone.trim()) e.phone = 'મોબાઈલ / લૉગિન જરૂરી છે';
    if (!editingId && (!form.password || form.password.length < 6))
      e.password = 'ઓછામાં ઓછા ૬ અક્ષર જરૂરી';
    if (editingId && form.password && form.password.length < 6)
      e.password = 'ઓછામાં ઓછા ૬ અક્ષર જરૂરી';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const villages = form.villages
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((village) => ({ village }));

    try {
      if (editingId) {
        const body = { status: form.status, villages };
        if (form.password) body.password = form.password;
        await updateMut.mutateAsync({ id: editingId, body });
      } else {
        await createMut.mutateAsync({
          name: form.name.trim(),
          phone: form.phone.trim(),
          password: form.password,
          villages,
        });
      }
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await updateMut.mutateAsync({
        id: user.id || user._id,
        body: { status: newStatus },
      });
    } catch (err) {
      setErrors({ submit: err.message });
    }
  };

  const busy = createMut.isPending || updateMut.isPending;

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">સબ-એડમિન (Sub-admins)</h1>
        <button className="btn-primary" onClick={openCreate}>
          + સબ-એડમિન ઉમેરો
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card mb-6">
          <h2 className="font-bold text-lg mb-3">
            {editingId ? 'સંપાદન (Edit)' : 'નવો સબ-એડમિન (New Sub-admin)'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label">{t.name}</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={!!editingId}
                placeholder="નામ લખો"
              />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <label className="label">{t.phone}</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                disabled={!!editingId}
                placeholder="મોબાઈલ નંબર"
              />
              <FieldError>{errors.phone}</FieldError>
            </div>
            <div>
              <label className="label">
                {t.password} {editingId && '(બદલવા માટે ભરો)'}
              </label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? 'ખાલી રાખો = બદલાશે નહીં' : 'ઓછામાં ઓછા ૬ અક્ષર'}
              />
              <FieldError>{errors.password}</FieldError>
            </div>
            <div>
              <label className="label">ગામ (comma-separated)</label>
              <input
                className="input"
                value={form.villages}
                onChange={(e) => setForm({ ...form, villages: e.target.value })}
                placeholder="ગામ ૧, ગામ ૨, ..."
              />
            </div>
            {editingId && (
              <div className="flex items-center gap-3">
                <label className="label mb-0">સ્ટેટસ:</label>
                <button
                  type="button"
                  className={`chip ${form.status === 'active' ? 'bg-green-100 border-green-400 text-green-800' : 'bg-red-100 border-red-400 text-red-800'}`}
                  onClick={() =>
                    setForm({ ...form, status: form.status === 'active' ? 'disabled' : 'active' })
                  }
                >
                  {form.status === 'active' ? 'સક્રિય (Active)' : 'નિષ્ક્રિય (Disabled)'}
                </button>
              </div>
            )}
            <FieldError>{errors.submit}</FieldError>
            <div className="flex gap-3 pt-2">
              <button className="btn-primary" type="submit" disabled={busy}>
                {busy ? t.loading : t.save}
              </button>
              <button className="btn-secondary" type="button" onClick={resetForm} disabled={busy}>
                {t.cancel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User List */}
      {(!users || users.length === 0) ? (
        <EmptyState title="કોઈ સબ-એડમિન નથી" hint="ઉપર બટન વડે ઉમેરો" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {users.map((u) => {
            const uid = u.id || u._id;
            const villages = (u.villages || []).map((v) =>
              typeof v === 'string' ? v : v.village || ''
            ).filter(Boolean);
            return (
              <div key={uid} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-lg">{u.name}</div>
                    <div className="text-sm text-gray-500">{u.phone}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`chip text-xs py-1 px-2 ${
                        u.status === 'active'
                          ? 'bg-green-100 border-green-300 text-green-700'
                          : 'bg-red-100 border-red-300 text-red-700'
                      }`}
                    >
                      {u.status === 'active' ? 'સક્રિય' : 'નિષ્ક્રિય'}
                    </span>
                    <span className="chip text-xs py-1 px-2 bg-blue-50 border-blue-200 text-blue-700">
                      {u.role}
                    </span>
                  </div>
                </div>
                {villages.length > 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    <span className="font-medium">ગામ: </span>
                    {villages.join(', ')}
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    className="btn-secondary py-2 px-3 text-sm"
                    onClick={() => openEdit(u)}
                  >
                    સંપાદન
                  </button>
                  <button
                    className={`py-2 px-3 text-sm ${u.status === 'active' ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => toggleStatus(u)}
                    disabled={busy}
                  >
                    {u.status === 'active' ? 'નિષ્ક્રિય કરો' : 'સક્રિય કરો'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
