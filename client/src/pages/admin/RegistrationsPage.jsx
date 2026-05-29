import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getRegistrations, linkCouple, getSchemes } from '../../api/resources';
import { Loading, ErrorState, EmptyState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t } from '../../lib/i18n';

export default function RegistrationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [schemeId, setSchemeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  
  // Link state
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedGroom, setSelectedGroom] = useState(null);
  const [selectedBride, setSelectedBride] = useState(null);
  const [linkVillage, setLinkVillage] = useState('');

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  
  const regQ = useQuery({
    queryKey: ['registrations', schemeId, year],
    queryFn: () => getRegistrations({ schemeId, year }),
    enabled: !!schemeId
  });

  const linkMut = useMutation({
    mutationFn: (body) => linkCouple(body),
    onSuccess: () => {
      queryClient.invalidateQueries(['registrations']);
      setLinkOpen(false);
      setSelectedGroom(null);
      setSelectedBride(null);
      setLinkVillage('');
    }
  });

  const list = regQ.data || [];
  
  // Group by couple
  const couplesMap = {};
  const unlinked = { groom: [], bride: [], na: [] };
  
  list.forEach(r => {
    if (r.coupleId) {
      const cid = typeof r.coupleId === 'object' ? r.coupleId._id : r.coupleId;
      if (!couplesMap[cid]) couplesMap[cid] = { couple: typeof r.coupleId === 'object' ? r.coupleId : {}, groom: null, bride: null };
      if (r.side === 'groom') couplesMap[cid].groom = r;
      else if (r.side === 'bride') couplesMap[cid].bride = r;
      else couplesMap[cid].other = r;
    } else {
      unlinked[r.side || 'na'].push(r);
    }
  });

  const getStatusColor = (s) => {
    switch(s) {
      case 'verified': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'submitted': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const RegistrationCard = ({ reg, title }) => {
    if (!reg) return <div className="p-3 border border-dashed rounded-lg text-center text-gray-400 bg-gray-50 flex-1">{title} missing</div>;
    return (
      <div className="p-3 border rounded-lg hover:shadow-md transition cursor-pointer flex-1" onClick={() => navigate(`/admin/registrations/${reg._id}`)}>
        <div className="flex justify-between items-start mb-1">
          <span className="font-bold">{reg.values?.name || 'No Name'}</span>
          <span className={`chip text-xs ${getStatusColor(reg.status)}`}>{reg.status}</span>
        </div>
        <div className="text-xs text-gray-500">
          Side: {reg.side} · v{reg.formTemplateVersion}
        </div>
      </div>
    );
  };

  const handleOpenLink = () => {
    if (!selectedGroom || !selectedBride) return;
    setLinkOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{t.registrations}</h1>
        {schemeId && (
          <Link to="/admin/registrations/new" state={{ schemeId, year }} className="btn-primary py-1.5 px-3">
            + New
          </Link>
        )}
      </div>

      <div className="card mb-4 flex gap-3 flex-wrap">
        <div>
          <label className="label">{t.scheme}</label>
          <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
            <option value="">— પસંદ કરો —</option>
            {(schemesQ.data || []).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <input type="number" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
      </div>

      {!schemeId ? (
        <EmptyState title="યોજના પસંદ કરો (Select Scheme)" />
      ) : regQ.isLoading ? (
        <Loading />
      ) : regQ.error ? (
        <ErrorState error={regQ.error} onRetry={regQ.refetch} />
      ) : list.length === 0 ? (
        <EmptyState title={t.noData} />
      ) : (
        <div className="space-y-6">
          {/* Couples */}
          {Object.values(couplesMap).length > 0 && (
            <div>
              <h2 className="font-bold text-lg mb-3">Couples ({Object.values(couplesMap).length})</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {Object.values(couplesMap).map(({ couple, groom, bride }) => (
                  <div key={couple._id} className="card p-4">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b">
                      <span className="font-bold text-brand">{couple.registrationNo || 'Draft'}</span>
                      <span className="text-sm text-gray-500">{couple.village}</span>
                    </div>
                    <div className="flex gap-3">
                      <RegistrationCard reg={groom} title={t.groom} />
                      <RegistrationCard reg={bride} title={t.bride} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unlinked */}
          {(unlinked.groom.length > 0 || unlinked.bride.length > 0) && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h2 className="font-bold text-lg">Unlinked Registrations</h2>
                <button className="btn-secondary" onClick={handleOpenLink} disabled={!selectedGroom || !selectedBride}>
                  {t.linkCouple}
                </button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card bg-blue-50/50">
                  <h3 className="font-bold mb-2 text-blue-800">{t.groom}s</h3>
                  <div className="space-y-2">
                    {unlinked.groom.map(r => (
                      <label key={r._id} className="flex gap-2 items-start p-2 bg-white border rounded cursor-pointer">
                        <input type="radio" name="g_select" className="mt-1" checked={selectedGroom===r._id} onChange={()=>setSelectedGroom(r._id)} />
                        <div className="flex-1" onClick={(e)=>e.preventDefault()}>
                          <RegistrationCard reg={r} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="card bg-pink-50/50">
                  <h3 className="font-bold mb-2 text-pink-800">{t.bride}s</h3>
                  <div className="space-y-2">
                    {unlinked.bride.map(r => (
                      <label key={r._id} className="flex gap-2 items-start p-2 bg-white border rounded cursor-pointer">
                        <input type="radio" name="b_select" className="mt-1" checked={selectedBride===r._id} onChange={()=>setSelectedBride(r._id)} />
                        <div className="flex-1" onClick={(e)=>e.preventDefault()}>
                          <RegistrationCard reg={r} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={linkOpen}
        title={t.linkCouple}
        message="વર અને કન્યાને જોડીને નવું યુગલ (Couple) બનાવો."
        detail={
          <div>
            <label className="label">{t.village} *</label>
            <input className="input" value={linkVillage} onChange={e=>setLinkVillage(e.target.value)} placeholder="ગામનું નામ" />
          </div>
        }
        confirmLabel="જોડો (Link)"
        onConfirm={() => {
          if(!linkVillage) return;
          linkMut.mutate({ groomRegistrationId: selectedGroom, brideRegistrationId: selectedBride, village: linkVillage, year });
        }}
        onCancel={() => setLinkOpen(false)}
        busy={linkMut.isPending}
      />
    </div>
  );
}
