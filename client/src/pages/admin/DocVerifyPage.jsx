import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRegistrations, getDocuments, verifyDocument, rejectDocument, resubmitDocument } from '../../api/resources';
import { Loading, EmptyState, ErrorState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { t } from '../../lib/i18n';

export default function DocVerifyPage() {
  const queryClient = useQueryClient();
  const [selectedReg, setSelectedReg] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  const regsQ = useQuery({ queryKey: ['registrations'], queryFn: () => getRegistrations({}) });
  
  const docsQ = useQuery({
    queryKey: ['documents', selectedReg],
    queryFn: () => getDocuments({ registrationId: selectedReg }),
    enabled: !!selectedReg
  });

  const verifyMut = useMutation({
    mutationFn: (id) => verifyDocument(id),
    onSuccess: () => { queryClient.invalidateQueries(['documents']); queryClient.invalidateQueries(['registrations']); }
  });

  const rejectMut = useMutation({
    mutationFn: ({id, reason}) => rejectDocument(id, reason),
    onSuccess: () => { queryClient.invalidateQueries(['documents']); setRejectTarget(null); setRejectReason(''); }
  });

  const resubmitMut = useMutation({
    mutationFn: ({id, fileUrl}) => resubmitDocument(id, { fileUrl }),
    onSuccess: () => queryClient.invalidateQueries(['documents'])
  });

  const handleVerify = (id) => verifyMut.mutate(id);
  const handleReject = () => rejectMut.mutate({ id: rejectTarget._id, reason: rejectReason });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{t.docVerify}</h1>

      <div className="card mb-4">
        <label className="label">નોંધણી પસંદ કરો (Select Registration)</label>
        <select className="input" value={selectedReg} onChange={e=>setSelectedReg(e.target.value)}>
          <option value="">— પસંદ કરો —</option>
          {(regsQ.data || []).map(r => (
            <option key={r._id} value={r._id}>
              {r.values?.name || r._id} ({r.side}) - {r.status}
            </option>
          ))}
        </select>
      </div>

      {selectedReg && docsQ.isLoading && <Loading />}
      {selectedReg && docsQ.error && <ErrorState error={docsQ.error} onRetry={docsQ.refetch} />}
      
      {selectedReg && docsQ.data && (
        <div className="space-y-4">
          {docsQ.data.length === 0 ? <EmptyState title="કોઈ ડોક્યુમેન્ટ નથી" /> : null}
          {docsQ.data.map(doc => (
            <div key={doc._id} className="card flex flex-col md:flex-row gap-4 p-4">
              {/* Viewer */}
              <div className="md:w-1/2 bg-gray-50 border rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center">
                {doc.fileUrl ? (
                  doc.fileUrl.endsWith('.pdf') ? 
                    <iframe src={doc.fileUrl} className="w-full h-[400px]" title={doc.type} /> :
                    <img src={doc.fileUrl} className="max-w-full max-h-[400px] object-contain" alt={doc.type} />
                ) : (
                  <span className="text-gray-400">ફાઈલ નથી</span>
                )}
              </div>

              {/* Controls */}
              <div className="md:w-1/2 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{doc.type}</h3>
                    <div className="text-sm text-gray-500">Version {doc.version}</div>
                  </div>
                  <span className={`chip ${doc.status === 'verified' ? 'bg-green-100 text-green-800' : doc.status === 'resubmit' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {doc.status}
                  </span>
                </div>

                {doc.status === 'resubmit' && (
                  <div className="bg-red-50 text-red-800 p-3 rounded-lg mb-4 text-sm border border-red-200">
                    <span className="font-bold">નામંજૂર કારણ:</span> {doc.rejectReason}
                  </div>
                )}

                {doc.status === 'pending' && (
                  <div className="flex gap-3 mt-auto">
                    <button className="btn-danger flex-1" onClick={()=>setRejectTarget(doc)} disabled={verifyMut.isPending}>
                      નામંજૂર (Reject)
                    </button>
                    <button className="btn-primary flex-1" onClick={()=>handleVerify(doc._id)} disabled={verifyMut.isPending}>
                      ખાતરી (Verify)
                    </button>
                  </div>
                )}

                {doc.status === 'resubmit' && (
                  <div className="mt-auto">
                    <label className="label">નવી ફાઈલ અપલોડ કરો</label>
                    <input type="file" className="input" onChange={e => {
                      // Fake upload for demo
                      resubmitMut.mutate({ id: doc._id, fileUrl: 'https://placehold.co/600x400/png?text=New+Document' });
                    }} disabled={resubmitMut.isPending} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!rejectTarget}
        title="ડોક્યુમેન્ટ નામંજૂર કરો"
        danger
        detail={
          <div>
            <label className="label">{t.rejectReason} *</label>
            <input className="input" value={rejectReason} onChange={e=>setRejectReason(e.target.value)} />
          </div>
        }
        onConfirm={handleReject}
        onCancel={() => { setRejectTarget(null); setRejectReason(''); }}
        busy={rejectMut.isPending}
      />
    </div>
  );
}
