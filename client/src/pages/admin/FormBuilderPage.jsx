import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSchemes, getFormTemplates, createFormTemplate, updateFormTemplate } from '../../api/resources';
import { Loading, ErrorState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t } from '../../lib/i18n';

const FIELD_TYPES = [
  { value: 'text', label: t.typeText },
  { value: 'number', label: t.typeNumber },
  { value: 'date', label: t.typeDate },
  { value: 'select', label: t.typeSelect },
  { value: 'file', label: t.typeFile },
  { value: 'checkbox', label: t.typeCheckbox },
];

export default function FormBuilderPage() {
  const queryClient = useQueryClient();
  const [schemeId, setSchemeId] = useState('');
  const [fields, setFields] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Field modal state
  const [editIndex, setEditIndex] = useState(-1);
  const [fKey, setFKey] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [fType, setFType] = useState('text');
  const [fReq, setFReq] = useState(false);
  const [fOpts, setFOpts] = useState(''); // for select
  const [fMin, setFMin] = useState(''); // for number
  const [fMax, setFMax] = useState(''); // for number

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  
  const templatesQ = useQuery({
    queryKey: ['formTemplates', schemeId],
    queryFn: () => getFormTemplates(schemeId),
    enabled: !!schemeId,
    onSuccess: (data) => {
      const active = data.find(t => t.active);
      if (active) {
        setFields(active.fields.map(f => ({...f})));
      } else {
        setFields([]);
      }
    }
  });

  const activeTemplate = templatesQ.data?.find(t => t.active);
  const vNum = activeTemplate?.version || 0;

  const saveMut = useMutation({
    mutationFn: () => {
      // clean order
      const payload = fields.map((f, i) => ({ ...f, order: i }));
      if (activeTemplate) {
        return updateFormTemplate(activeTemplate._id, { fields: payload });
      } else {
        return createFormTemplate({ schemeId, fields: payload });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['formTemplates', schemeId]);
      setConfirmOpen(false);
    }
  });

  const handleSave = () => {
    if (!schemeId) return;
    setConfirmOpen(true);
  };

  const moveField = (idx, dir) => {
    const arr = [...fields];
    if (dir === -1 && idx > 0) {
      [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
      setFields(arr);
    } else if (dir === 1 && idx < arr.length - 1) {
      [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
      setFields(arr);
    }
  };

  const removeField = (idx) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const openModal = (idx = -1) => {
    setEditIndex(idx);
    if (idx >= 0) {
      const f = fields[idx];
      setFKey(f.key); setFLabel(f.label); setFType(f.type); setFReq(f.required);
      setFOpts(f.validation?.options?.join(',') || '');
      setFMin(f.validation?.min || '');
      setFMax(f.validation?.max || '');
    } else {
      setFKey(''); setFLabel(''); setFType('text'); setFReq(false);
      setFOpts(''); setFMin(''); setFMax('');
    }
  };

  const saveField = () => {
    if (!fKey.trim() || !fLabel.trim()) return;
    const validation = {};
    if (fType === 'select') validation.options = fOpts.split(',').map(s=>s.trim()).filter(Boolean);
    if (fType === 'number') {
      if (fMin) validation.min = Number(fMin);
      if (fMax) validation.max = Number(fMax);
    }

    const nf = {
      key: fKey.trim(),
      label: fLabel.trim(),
      type: fType,
      required: fReq,
      validation: Object.keys(validation).length ? validation : undefined
    };

    if (editIndex >= 0) {
      const arr = [...fields];
      arr[editIndex] = nf;
      setFields(arr);
    } else {
      setFields([...fields, nf]);
    }
    setEditIndex(-1);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{t.formBuilder}</h1>
        {activeTemplate && (
          <span className="chip bg-blue-100 text-blue-800 border-blue-200">
            Version: {vNum}
          </span>
        )}
      </div>

      <div className="card mb-4">
        <label className="label">{t.scheme}</label>
        <select 
          className="input" 
          value={schemeId} 
          onChange={(e) => {
            setSchemeId(e.target.value);
            setFields([]);
          }}
        >
          <option value="">— પસંદ કરો —</option>
          {(schemesQ.data || []).map(s => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
        </select>
      </div>

      {schemeId && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-3">
            {templatesQ.isLoading ? <Loading /> : 
             fields.length === 0 ? <p className="text-gray-500 text-sm p-4 bg-gray-50 rounded">કોઈ ફિલ્ડ નથી (No fields). ઉમેરો બટન દબાવો.</p> :
             fields.map((f, i) => (
              <div key={i} className="card p-3 flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button type="button" disabled={i===0} onClick={()=>moveField(i, -1)} className="text-gray-400 hover:text-brand disabled:opacity-30">▲</button>
                  <button type="button" disabled={i===fields.length-1} onClick={()=>moveField(i, 1)} className="text-gray-400 hover:text-brand disabled:opacity-30">▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{f.label}</span>
                    <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1 rounded">{f.key}</span>
                    {f.required && <span className="text-xs text-red-500">*</span>}
                  </div>
                  <div className="text-sm text-gray-600 flex gap-2 mt-1">
                    <span className="chip bg-gray-100 text-xs px-1.5 py-0.5">{f.type}</span>
                    {f.type === 'select' && f.validation?.options && <span className="text-xs text-gray-400 truncate">[{f.validation.options.join(', ')}]</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-brand text-sm" onClick={() => openModal(i)}>Edit</button>
                  <button className="text-red-500 text-sm" onClick={() => removeField(i)}>✕</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card h-fit sticky top-4">
            <h3 className="font-bold mb-3">{editIndex >= 0 ? 'Edit Field' : t.addField}</h3>
            <div className="space-y-3">
              <div>
                <label className="label">{t.fieldKey} (e.g. firstName)</label>
                <input className="input" value={fKey} onChange={e=>setFKey(e.target.value)} />
              </div>
              <div>
                <label className="label">{t.fieldLabel} (e.g. પહેલું નામ)</label>
                <input className="input" value={fLabel} onChange={e=>setFLabel(e.target.value)} />
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={fType} onChange={e=>setFType(e.target.value)}>
                  {FIELD_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={fReq} onChange={e=>setFReq(e.target.checked)} />
                <span className="text-sm">{t.required}</span>
              </label>

              {fType === 'select' && (
                <div>
                  <label className="label">{t.options}</label>
                  <input className="input" placeholder="Yes, No, Maybe" value={fOpts} onChange={e=>setFOpts(e.target.value)} />
                </div>
              )}
              {fType === 'number' && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="label">Min</label>
                    <input type="number" className="input" value={fMin} onChange={e=>setFMin(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <label className="label">Max</label>
                    <input type="number" className="input" value={fMax} onChange={e=>setFMax(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {editIndex >= 0 && <button className="btn-secondary flex-1" onClick={()=>setEditIndex(-1)}>Cancel</button>}
                <button className="btn-primary flex-1" onClick={saveField} disabled={!fKey || !fLabel}>
                  {editIndex >= 0 ? t.save : t.addField}
                </button>
              </div>
            </div>

            <hr className="my-4" />
            <button className="btn-primary w-full" onClick={handleSave} disabled={fields.length === 0 || saveMut.isPending}>
              {saveMut.isPending ? t.loading : `Save Template (v${vNum + 1})`}
            </button>
            {saveMut.error && <FieldError>{saveMut.error.message}</FieldError>}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Save Template"
        message={`Are you sure you want to save? This will create Version ${vNum + 1}. Old registrations will not be affected.`}
        onConfirm={() => saveMut.mutate()}
        onCancel={() => setConfirmOpen(false)}
        busy={saveMut.isPending}
      />
    </div>
  );
}
