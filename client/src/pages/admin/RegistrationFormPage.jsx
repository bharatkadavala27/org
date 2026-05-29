import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRegistration, createRegistration, updateRegistration, submitRegistration, getActiveTemplate, uploadFile } from '../../api/resources';
import { Loading, ErrorState, FieldError } from '../../components/States';
import { t } from '../../lib/i18n';

export default function RegistrationFormPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  
  // For new, expect state: { schemeId, year }
  const initSchemeId = location.state?.schemeId;
  const initYear = location.state?.year;

  const [side, setSide] = useState('groom');
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState({});

  const regQ = useQuery({
    queryKey: ['registration', id],
    queryFn: () => getRegistration(id),
    enabled: !isNew
  });

  const schemeId = isNew ? initSchemeId : regQ.data?.schemeId;

  const templateQ = useQuery({
    queryKey: ['activeTemplate', schemeId],
    queryFn: () => getActiveTemplate(schemeId),
    enabled: !!schemeId && (isNew || regQ.data?.status === 'draft')
  });

  // Load existing data
  useEffect(() => {
    if (regQ.data) {
      setSide(regQ.data.side);
      setValues(regQ.data.values || {});
    }
  }, [regQ.data]);

  const template = isNew ? templateQ.data : (regQ.data?.status === 'draft' ? templateQ.data : { fields: [] }); // Simplification for demo
  const fields = template?.fields || [];
  const status = isNew ? 'draft' : regQ.data?.status;
  const readOnly = status !== 'draft' && status !== 'rejected';

  const validate = () => {
    const e = {};
    fields.forEach(f => {
      if (f.required && !values[f.key]) e[f.key] = t.required;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMut = useMutation({
    mutationFn: (isSubmit) => {
      if (isNew) {
        return createRegistration({ schemeId, year: initYear, side, values });
      } else {
        return isSubmit ? submitRegistration(id) : updateRegistration(id, { values, side });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['registrations']);
      navigate('/admin/registrations');
    }
  });

  const handleSaveDraft = (e) => {
    e.preventDefault();
    saveMut.mutate(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    saveMut.mutate(true); // in real app, we'd update then submit, or submit does both
  };

  const handleFileChange = async (key, file) => {
    if (!file) return;
    setUploading(prev => ({...prev, [key]: true}));
    try {
      const res = await uploadFile(file, 'photos');
      setValues(prev => ({...prev, [key]: res.url}));
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(prev => ({...prev, [key]: false}));
    }
  };

  if ((!isNew && regQ.isLoading) || templateQ.isLoading) return <Loading />;
  if (!isNew && regQ.error) return <ErrorState error={regQ.error} />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{isNew ? 'નવી નોંધણી (New)' : 'નોંધણી ફોર્મ (Registration)'}</h1>
        {!isNew && <span className="chip bg-gray-100">{status}</span>}
      </div>

      <div className="card">
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">પક્ષ (Side)</label>
              <select className="input" value={side} onChange={e=>setSide(e.target.value)} disabled={readOnly}>
                <option value="groom">{t.groom}</option>
                <option value="bride">{t.bride}</option>
                <option value="na">N/A</option>
              </select>
            </div>
          </div>

          <hr className="my-4" />

          {fields.map(f => (
            <div key={f.key}>
              <label className="label">{f.label} {f.required && '*'}</label>
              
              {f.type === 'text' && (
                <input type="text" className="input" value={values[f.key] || ''} onChange={e=>setValues({...values, [f.key]: e.target.value})} disabled={readOnly} />
              )}
              {f.type === 'number' && (
                <input type="number" className="input" value={values[f.key] || ''} onChange={e=>setValues({...values, [f.key]: Number(e.target.value)})} disabled={readOnly} />
              )}
              {f.type === 'date' && (
                <input type="date" className="input" value={values[f.key] || ''} onChange={e=>setValues({...values, [f.key]: e.target.value})} disabled={readOnly} />
              )}
              {f.type === 'select' && (
                <select className="input" value={values[f.key] || ''} onChange={e=>setValues({...values, [f.key]: e.target.value})} disabled={readOnly}>
                  <option value="">—</option>
                  {(f.validation?.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
              {f.type === 'checkbox' && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!values[f.key]} onChange={e=>setValues({...values, [f.key]: e.target.checked})} disabled={readOnly} />
                  <span>Yes / હા</span>
                </label>
              )}
              {f.type === 'file' && (
                <div>
                  {values[f.key] ? (
                    <div className="flex items-center gap-3">
                      <img src={values[f.key]} className="h-16 w-16 object-cover rounded border" alt="" />
                      {!readOnly && <button type="button" className="text-red-500 text-sm" onClick={()=>setValues({...values, [f.key]: null})}>Remove</button>}
                    </div>
                  ) : (
                    <input type="file" className="input" onChange={e=>handleFileChange(f.key, e.target.files[0])} disabled={readOnly || uploading[f.key]} />
                  )}
                  {uploading[f.key] && <div className="text-xs text-brand mt-1">Uploading...</div>}
                </div>
              )}

              <FieldError>{errors[f.key]}</FieldError>
            </div>
          ))}

          {!readOnly && (
            <div className="flex gap-3 pt-4">
              <button className="btn-secondary flex-1" onClick={handleSaveDraft} disabled={saveMut.isPending}>
                Save Draft
              </button>
              <button className="btn-primary flex-1" onClick={handleSubmit} disabled={saveMut.isPending}>
                Submit
              </button>
            </div>
          )}
          {saveMut.error && <FieldError>{saveMut.error.message}</FieldError>}
        </form>
      </div>
    </div>
  );
}
