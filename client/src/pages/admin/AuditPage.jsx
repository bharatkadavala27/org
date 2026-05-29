import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAudit } from '../../api/resources';
import { api } from '../../api/client';
import { Loading, EmptyState, ErrorState } from '../../components/States';

const ENTITY_OPTIONS = [
  { value: '', label: 'બધા (All)' },
  { value: 'Slip', label: 'slip' },
  { value: 'Donor', label: 'donor' },
  { value: 'Handover', label: 'handover' },
  { value: 'User', label: 'user' },
  { value: 'Setting', label: 'settings' },
];

const PAGE_SIZES = [25, 50, 100, 200];

// Build params, dropping empties so we never send blank filters to the server.
function buildParams({ from, to, role, action, entity, userId, page, limit }) {
  const p = { page, limit };
  if (from) p.from = from;
  if (to) p.to = to;
  if (role) p.role = role;
  if (entity) p.entityType = entity;
  if (userId) p.userId = userId;
  if (action && action.trim()) p.action = action.trim();
  return p;
}

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDetail(before, after) {
  const parts = [];
  if (before != null) {
    try { parts.push('Before: ' + JSON.stringify(before, null, 2)); } catch { parts.push('Before: ' + String(before)); }
  }
  if (after != null) {
    try { parts.push('After: ' + JSON.stringify(after, null, 2)); } catch { parts.push('After: ' + String(after)); }
  }
  return parts.length ? parts.join('\n\n') : '—';
}

// Debounce the free-text "action contains" filter so we don't refetch per keystroke.
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function AuditPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState('');
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [user, setUser] = useState('');
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);

  const [expanded, setExpanded] = useState({}); // { [id]: boolean }
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const debouncedAction = useDebounce(action, 400);
  const debouncedUser = useDebounce(user, 400);

  // Reset to page 1 whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [from, to, role, entity, debouncedAction, debouncedUser, limit]);

  const params = useMemo(
    () => buildParams({ from, to, role, entity, action: debouncedAction, userId: debouncedUser, page, limit }),
    [from, to, role, entity, debouncedAction, debouncedUser, page, limit]
  );

  const auditQ = useQuery({
    queryKey: ['audit', params],
    queryFn: () => getAudit(params),
    keepPreviousData: true,
  });

  const data = auditQ.data;
  const logs = data?.rows || [];
  const total = data?.total ?? 0;
  const currentPage = data?.page ?? page;
  const totalPages = Math.max(1, Math.ceil(total / (data?.limit || limit)));

  const toggleRow = useCallback((id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  function resetFilters() {
    setFrom('');
    setTo('');
    setRole('');
    setEntity('');
    setAction('');
    setUser('');
    setLimit(50);
    setPage(1);
  }

  async function exportCsv() {
    setExportError('');
    setExporting(true);
    try {
      const res = await api.get('/api/audit/export.csv', {
        params: buildParams({ from, to, role, entity, action: debouncedAction, userId: debouncedUser, page: 1, limit: 10000 }),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit_log.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err?.message || 'CSV એક્સપોર્ટ નિષ્ફળ. (CSV export failed.)');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">ઑડિટ લોગ (Audit log)</h1>
      <p className="text-sm text-gray-500 mb-4">
        સિસ્ટમમાં થયેલા ફેરફારોની નોંધ. (A record of changes made in the system.)
      </p>

      {/* ---------- FILTERS ---------- */}
      <div className="card mb-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <div>
            <label className="label">થી તારીખ (From)</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">સુધી તારીખ (To)</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label">ભૂમિકા (Role)</label>
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">બધા (All)</option>
              <option value="admin">admin</option>
              <option value="subadmin">subadmin</option>
            </select>
          </div>
          <div>
            <label className="label">એન્ટિટી (Entity)</label>
            <select className="input" value={entity} onChange={(e) => setEntity(e.target.value)}>
              {ENTITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ક્રિયા (Action)</label>
            <input type="text" className="input" placeholder="e.g. update" value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div>
            <label className="label">વપરાશકર્તા (User)</label>
            <input type="text" className="input" placeholder="User ID" value={user} onChange={(e) => setUser(e.target.value)} />
          </div>
          <div>
            <label className="label">પ્રતિ પેજ (Size)</label>
            <select className="input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-4">
          <button type="button" className="btn-secondary" onClick={resetFilters}>
            રીસેટ (Reset)
          </button>
          <button type="button" className="btn-secondary" onClick={exportCsv} disabled={exporting}>
            {exporting ? 'એક્સપોર્ટ થઈ રહ્યું છે…' : 'CSV એક્સપોર્ટ (Export CSV)'}
          </button>
        </div>
        {exportError && <p className="text-sm text-red-600 mt-2">{exportError}</p>}
      </div>

      {/* ---------- RESULTS ---------- */}
      <div className="card">
        {auditQ.isLoading ? (
          <Loading label="લોગ લોડ થઈ રહ્યો છે… (Loading audit log…)" />
        ) : auditQ.error ? (
          <ErrorState error={auditQ.error} onRetry={auditQ.refetch} />
        ) : logs.length === 0 ? (
          <EmptyState
            title="કોઈ લોગ મળ્યો નથી (No audit entries)"
            hint="ફિલ્ટર બદલીને ફરી પ્રયત્ન કરો. (Try changing the filters.)"
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between mb-3 text-sm text-gray-600">
              <div>કુલ (Total): <span className="font-semibold">{total}</span></div>
              <div>પેજ (Page) {currentPage} / {totalPages}</div>
            </div>

            <div className="hidden md:block overflow-x-auto max-h-[70vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3 whitespace-nowrap">સમય (Time)</th>
                    <th className="py-2 pr-3">વપરાશકર્તા (User)</th>
                    <th className="py-2 pr-3">ક્રિયા (Action)</th>
                    <th className="py-2 pr-3">એન્ટિટી (Entity)</th>
                    <th className="py-2 pr-3">વિગત (Detail)</th>
                    <th className="py-2 pr-3">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((r) => (
                    <TableRow key={r.id} log={r} isOpen={Boolean(expanded[r.id])} onToggle={() => toggleRow(r.id)} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3">
              {logs.map((r) => (
                <MobileCard key={r.id} log={r} isOpen={Boolean(expanded[r.id])} onToggle={() => toggleRow(r.id)} />
              ))}
            </div>

            <div className="flex items-center justify-between mt-4">
              <button className="btn-secondary" disabled={currentPage <= 1 || auditQ.isFetching} onClick={() => setPage((p) => p - 1)}>← પાછળ</button>
              <button className="btn-secondary" disabled={currentPage >= totalPages || auditQ.isFetching} onClick={() => setPage((p) => p + 1)}>આગળ →</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TableRow({ log, isOpen, onToggle }) {
  const detailStr = formatDetail(log.before, log.after);
  const shortDetail = typeof detailStr === 'string' && detailStr.length > 60 ? detailStr.slice(0, 60) + '…' : detailStr;

  return (
    <>
      <tr className="border-b last:border-0 cursor-pointer hover:bg-gray-50 align-top" onClick={onToggle}>
        <td className="py-2 pr-3 whitespace-nowrap">{fmtTime(log.ts)}</td>
        <td className="py-2 pr-3">{log.user || '—'}</td>
        <td className="py-2 pr-3 font-medium">{log.action || '—'}</td>
        <td className="py-2 pr-3">{log.entityType || '—'}{log.entityId && <span className="text-gray-400 ml-1">#{log.entityId}</span>}</td>
        <td className="py-2 pr-3 max-w-xs truncate text-gray-600">{shortDetail}</td>
        <td className="py-2 pr-3 text-gray-500 text-xs">{log.role || '—'}</td>
      </tr>
      {isOpen && (
        <tr className="border-b last:border-0 bg-gray-50">
          <td colSpan={6} className="py-3 px-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">વિગત (Detail)</div>
            <pre className="text-xs bg-white border rounded-lg p-2 max-h-48 overflow-auto whitespace-pre-wrap">{detailStr}</pre>
          </td>
        </tr>
      )}
    </>
  );
}

function MobileCard({ log, isOpen, onToggle }) {
  return (
    <div className="card cursor-pointer" onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-sm">{log.action || '—'}</span>
            <span className="chip bg-gray-100 text-gray-600 border-gray-200 text-xs">{log.entityType || '—'}{log.entityId && ` #${log.entityId}`}</span>
          </div>
          <div className="text-xs text-gray-500">{log.user || '—'} · {fmtTime(log.ts)}</div>
          {log.role && <div className="text-xs text-gray-400 mt-0.5">Role: {log.role}</div>}
        </div>
        <span className="text-brand text-sm mt-1">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs font-semibold text-gray-500 mb-1">વિગત (Detail)</div>
          <pre className="text-xs bg-gray-50 border rounded-lg p-2 max-h-48 overflow-auto whitespace-pre-wrap">{formatDetail(log.before, log.after)}</pre>
        </div>
      )}
    </div>
  );
}
