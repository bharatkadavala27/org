import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSchemes, createScheme, updateScheme } from '../../api/resources';
import { Loading, ErrorState, FieldError } from '../../components/States';

export default function SchemesPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'samuh_lagna', active: true });
  const [formError, setFormError] = useState('');

  // Fetch all schemes (admin mode)
  const { data: schemes, isLoading, error, refetch } = useQuery({
    queryKey: ['schemes', 'all'],
    queryFn: () => getSchemes({ all: true })
  });

  const createMut = useMutation({
    mutationFn: (body) => createScheme(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
      resetForm();
    },
    onError: (err) => setFormError(err.message)
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }) => updateScheme(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schemes'] });
      resetForm();
    },
    onError: (err) => setFormError(err.message)
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', type: 'samuh_lagna', active: true });
    setFormError('');
  };

  const handleEdit = (scheme) => {
    setEditingId(scheme.id);
    setForm({ name: scheme.name, type: scheme.type || 'other', active: scheme.active });
    setFormError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setFormError('Name is required');
    
    if (editingId) {
      updateMut.mutate({ id: editingId, body: form });
    } else {
      createMut.mutate(form);
    }
  };

  const toggleActive = (scheme) => {
    updateMut.mutate({ id: scheme.id, body: { active: !scheme.active } });
  };

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ઈવેન્ટ્સ / સ્કીમ (Schemes)</h1>
          <p className="text-sm text-gray-500 mt-1">Manage events, mass marriages, and active contribution schemes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Form Column */}
        <div className="md:col-span-1">
          <div className="card p-5 bg-white sticky top-24 shadow-sm border border-gray-100">
            <h2 className="font-bold text-lg mb-4">{editingId ? 'Edit Scheme' : 'Create New Scheme'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Scheme Name</label>
                <input 
                  className="input w-full" 
                  value={form.name} 
                  onChange={(e) => setForm({...form, name: e.target.value})} 
                  placeholder="12th Samuh Lagna - 2027" 
                />
              </div>
              
              <div>
                <label className="label">Type</label>
                <select 
                  className="input w-full" 
                  value={form.type} 
                  onChange={(e) => setForm({...form, type: e.target.value})}
                >
                  <option value="samuh_lagna">Samuh Lagna (સમૂહ લગ્ન)</option>
                  <option value="mameru">Mameru (મામેરું)</option>
                  <option value="other">Other (અન્ય)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="active-toggle"
                  className="h-5 w-5 rounded text-brand focus:ring-brand cursor-pointer"
                  checked={form.active}
                  onChange={(e) => setForm({...form, active: e.target.checked})}
                />
                <label htmlFor="active-toggle" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Is Active (Accepting donations & registrations)
                </label>
              </div>

              <FieldError>{formError}</FieldError>
              
              <div className="pt-2 flex gap-2">
                <button 
                  type="submit" 
                  className="btn-primary w-full py-2" 
                  disabled={createMut.isPending || updateMut.isPending}
                >
                  {editingId ? 'Update Scheme' : 'Create Scheme'}
                </button>
                {editingId && (
                  <button type="button" className="btn-secondary py-2 px-3" onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className="md:col-span-2 space-y-3">
          {(!schemes || schemes.length === 0) ? (
            <div className="card p-8 text-center text-gray-500 bg-gray-50 border border-dashed">
              No schemes found. Create your first scheme to get started.
            </div>
          ) : (
            schemes.map((scheme) => (
              <div key={scheme.id} className={`card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 transition-all ${scheme.active ? 'border-l-green-500 bg-white' : 'border-l-gray-300 bg-gray-50 opacity-75'}`}>
                <div>
                  <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                    {scheme.name}
                    {!scheme.active && <span className="chip text-xs bg-gray-200 text-gray-600">Inactive</span>}
                    {scheme.active && <span className="chip text-xs bg-green-100 text-green-700 font-bold">Active</span>}
                  </h3>
                  <div className="text-sm text-gray-500 mt-1 flex gap-3">
                    <span>Type: {scheme.type}</span>
                    <span>Created: {new Date(scheme.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => toggleActive(scheme)}
                    className={`btn-secondary text-xs py-1.5 px-3 flex-1 sm:flex-none ${scheme.active ? 'hover:bg-red-50 hover:text-red-700' : 'hover:bg-green-50 hover:text-green-700'}`}
                  >
                    {scheme.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button 
                    onClick={() => handleEdit(scheme)}
                    className="btn-primary text-xs py-1.5 px-4 flex-1 sm:flex-none"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
