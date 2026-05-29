import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSchemes, validateImport, commitImport } from '../../api/resources';
import { parseSpreadsheet, toCsv, downloadText } from '../../lib/excel';
import { Loading, ErrorState, FieldError } from '../../components/States';
import ConfirmDialog from '../../components/ConfirmDialog';
import { inr } from '../../lib/i18n';

// System fields a source column can map to (must match the backend SYSTEM_FIELDS).
const SYSTEM_FIELDS = ['name', 'fatherOrHusbandName', 'village', 'taluka', 'jilla', 'mobile', 'amount', 'year'];
const REQUIRED_FIELDS = ['name', 'amount'];
const IGNORE = '';
const ACCEPT = '.xlsx,.xls,.csv';

// Gujarati (English) labels for the system fields.
const FIELD_LABELS = {
  name: 'નામ (Name)',
  fatherOrHusbandName: 'પિતા/પતિનું નામ (Father/Husband)',
  village: 'ગામ (Village)',
  taluka: 'તાલુકો (Taluka)',
  jilla: 'જિલ્લો (Jilla)',
  mobile: 'મોબાઈલ (Mobile)',
  amount: 'રકમ (Amount)',
  year: 'વર્ષ (Year)',
};

const STEPS = [
  { n: 1, label: 'અપલોડ (Upload)' },
  { n: 2, label: 'કૉલમ મેપ (Map)' },
  { n: 3, label: 'પૂર્વાવલોકન (Preview)' },
  { n: 4, label: 'ઈમ્પોર્ટ (Import)' },
  { n: 5, label: 'પરિણામ (Result)' },
];

const MAP_PREFIX = 'importColumnMap:';

// Stable key for a header set so a similar file remembers its mapping.
function headerKey(headers) {
  return MAP_PREFIX + (Array.isArray(headers) ? headers.map((h) => String(h).trim().toLowerCase()).join('|') : '');
}

function loadSavedMap(headers) {
  try {
    const raw = localStorage.getItem(headerKey(headers));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function saveMap(headers, mapping) {
  try {
    localStorage.setItem(headerKey(headers), JSON.stringify(mapping));
  } catch {
    // localStorage may be unavailable (private mode); mapping just won't persist.
  }
}

function Stepper({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 mb-5 text-sm">
      {STEPS.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={
                'inline-flex h-7 w-7 items-center justify-center rounded-full font-semibold ' +
                (active
                  ? 'bg-brand text-white'
                  : done
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'bg-gray-100 text-gray-500 border border-gray-300')
              }
            >
              {s.n}
            </span>
            <span className={active ? 'font-semibold' : 'text-gray-500'}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="text-gray-300 mx-1">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function Chip({ label, value, tone }) {
  const tones = {
    default: 'bg-gray-100 text-gray-700 border-gray-300',
    green: 'bg-green-100 text-green-700 border-green-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    red: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={'chip cursor-default ' + (tones[tone] || tones.default)}>
      {label}: <span className="font-bold">{value}</span>
    </span>
  );
}

export default function ImportPage() {
  const fileRef = useRef(null);
  const [step, setStep] = useState(1);

  // Step 1 state
  const [file, setFile] = useState(null);
  const [schemeId, setSchemeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [headers, setHeaders] = useState([]);
  const [matrix, setMatrix] = useState([]); // raw data rows (array of arrays), excludes header row
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Step 2 state: mapping is { [sourceHeaderIndex]: systemField | '' }
  const [mapping, setMapping] = useState({});
  const [mapError, setMapError] = useState('');

  // Step 3 state
  const [useExisting, setUseExisting] = useState({}); // { [_row]: boolean }

  // Step 4 confirm
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schemesQ = useQuery({ queryKey: ['schemes'], queryFn: getSchemes });
  const schemes = schemesQ.data || [];

  // ---- Step 1: parse a chosen/dropped file ----
  const processFile = useCallback(async (f) => {
    setParseError('');
    setFile(f);
    setParsing(true);
    try {
      const { headers: hdrs, rows } = await parseSpreadsheet(f);
      const cleanHeaders = (hdrs || []).filter((h) => String(h).trim() !== '');
      if (!cleanHeaders.length) {
        setHeaders([]);
        setMatrix([]);
        setParseError('કોઈ હેડર મળ્યા નથી. (No column headers detected in the first row.)');
        return;
      }
      setHeaders(hdrs);
      setMatrix(Array.isArray(rows) ? rows : []);
      // Load any remembered mapping for this header set, else auto-map exact name matches.
      const saved = loadSavedMap(hdrs);
      if (saved) {
        setMapping(saved);
      } else {
        const auto = {};
        hdrs.forEach((h, idx) => {
          const norm = String(h).trim().toLowerCase().replace(/[\s_]+/g, '');
          const match = SYSTEM_FIELDS.find((sf) => sf.toLowerCase() === norm);
          auto[idx] = match || IGNORE;
        });
        setMapping(auto);
      }
    } catch (err) {
      setHeaders([]);
      setMatrix([]);
      setParseError(err?.message || 'ફાઈલ વાંચી શકાઈ નથી. (Could not read the file.)');
    } finally {
      setParsing(false);
    }
  }, []);

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setFile(null);
      setHeaders([]);
      setMatrix([]);
      setParseError('');
      return;
    }
    processFile(f);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  const step1Valid = Boolean(file) && headers.length > 0 && Boolean(schemeId) && !parseError;

  // ---- Step 2: mapping helpers ----
  const mappedFields = useMemo(() => Object.values(mapping).filter(Boolean), [mapping]);
  const missingRequired = REQUIRED_FIELDS.filter((rf) => !mappedFields.includes(rf));

  function setColumnMap(idx, value) {
    setMapping((prev) => ({ ...prev, [idx]: value }));
    setMapError('');
  }

  function goFromMapping() {
    if (missingRequired.length) {
      setMapError('આ ફીલ્ડ મેપ કરવી જરૂરી છે: ' + missingRequired.map((f) => FIELD_LABELS[f]).join(', '));
      return;
    }
    saveMap(headers, mapping);
    goToPreview();
  }

  // ---- Build row objects from the matrix using the mapping ----
  const builtRows = useMemo(() => {
    if (!matrix.length) return [];
    return matrix.map((cells, i) => {
      const obj = { _row: i + 1 }; // 1-based data row index
      headers.forEach((_h, idx) => {
        const field = mapping[idx];
        if (field) {
          let val = cells[idx];
          if (field === 'amount' || field === 'year') {
            const num = Number(String(val ?? '').replace(/[, ₹]/g, ''));
            val = Number.isFinite(num) ? num : val;
          } else {
            val = val == null ? '' : String(val).trim();
          }
          obj[field] = val;
        }
      });
      return obj;
    });
  }, [matrix, headers, mapping]);

  // ---- Step 3: validation ----
  const validateMut = useMutation({
    mutationFn: () => validateImport({ rows: builtRows, schemeId, year: Number(year) }),
  });

  function goToPreview() {
    setUseExisting({});
    validateMut.mutate();
    setStep(3);
  }

  const validation = validateMut.data;
  const previewRows = validation?.results || [];
  const summary = validation?.summary || { total: 0, valid: 0, duplicates: 0, errors: 0 };

  function toggleUseExisting(row) {
    setUseExisting((prev) => ({ ...prev, [row._row]: !prev[row._row] }));
  }

  // Error/duplicate rows for the downloadable report.
  const errorReportRows = useMemo(
    () =>
      previewRows
        .filter((r) => (r.errors && r.errors.length) || r.alreadyImported)
        .map((r) => ({
          row: r._row,
          name: r.name,
          amount: r.amount,
          year: r.year,
          village: r.village,
          status: r.alreadyImported ? 'duplicate (already imported)' : 'error',
          errors: (r.errors || []).join('; '),
        })),
    [previewRows]
  );

  function downloadErrorReport(rows, filename) {
    const keys = ['row', 'name', 'amount', 'year', 'village', 'status', 'errors'];
    downloadText(filename, toCsv(keys, rows));
  }

  // ---- Build the commit payload (carry duplicateDonorId where toggled) ----
  const commitRows = useMemo(
    () =>
      previewRows.map((r) => {
        const base = { ...r };
        if (useExisting[r._row] && r.duplicateDonor?.id) {
          base.duplicateDonorId = r.duplicateDonor.id;
        }
        return base;
      }),
    [previewRows, useExisting]
  );

  // ---- Step 4: commit ----
  const commitMut = useMutation({
    mutationFn: () => commitImport({ rows: commitRows, schemeId, year: Number(year) }),
    onSuccess: () => {
      setConfirmOpen(false);
      setStep(5);
    },
    onError: () => {
      setConfirmOpen(false);
    },
  });

  const result = commitMut.data;

  function resetAll() {
    setStep(1);
    setFile(null);
    setSchemeId('');
    setYear(new Date().getFullYear());
    setHeaders([]);
    setMatrix([]);
    setParseError('');
    setMapping({});
    setMapError('');
    setUseExisting({});
    setConfirmOpen(false);
    setDragActive(false);
    validateMut.reset();
    commitMut.reset();
    if (fileRef.current) fileRef.current.value = '';
  }

  const schemeName = schemes.find((s) => s.id === schemeId)?.name || '';

  return (
    <div>
      <h1 className="text-xl font-bold mb-1">જૂનો ડેટા ઈમ્પોર્ટ (Import old data)</h1>
      <p className="text-sm text-gray-500 mb-4">
        Excel/CSV થી અગાઉના વર્ષોનો ડેટા ઈમ્પોર્ટ કરો. એક જ ફાઈલ ફરી ઈમ્પોર્ટ કરવાથી 0 નવી રો ઉમેરાય છે (idempotent).
      </p>

      <Stepper step={step} />

      {/* ---------- STEP 1: UPLOAD ---------- */}
      {step === 1 && (
        <div className="card max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">ફાઈલ (Excel / CSV)</label>
              <div
                role="button"
                tabIndex={0}
                className={
                  'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ' +
                  (dragActive ? 'border-brand bg-red-50' : 'border-gray-300 hover:border-brand hover:bg-gray-50')
                }
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
                }}
                onDrop={onDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
              >
                <p className="font-medium text-gray-700">
                  ફાઈલ અહીં છોડો અથવા ક્લિક કરો (Drop a file here or click to browse)
                </p>
                <p className="text-sm text-gray-500 mt-1">{file ? file.name : '.xlsx, .xls, .csv'}</p>
              </div>
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onFileChange} aria-label="Choose a spreadsheet file" />
              {parsing && <p className="text-sm text-gray-500 mt-1">ફાઈલ વાંચાઈ રહી છે… (Reading file…)</p>}
              <FieldError>{parseError}</FieldError>
            </div>

            <div>
              <label className="label">યોજના (Scheme)</label>
              {schemesQ.isLoading ? (
                <Loading label="યોજનાઓ લોડ થઈ રહી છે…" />
              ) : schemesQ.error ? (
                <ErrorState error={schemesQ.error} onRetry={schemesQ.refetch} />
              ) : (
                <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
                  <option value="">— પસંદ કરો (Select) —</option>
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="label">મૂળભૂત વર્ષ (Default year)</label>
              <input
                type="number"
                className="input"
                value={year}
                min="1900"
                max="2200"
                onChange={(e) => setYear(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">જે રો માં વર્ષ ન હોય તેને આ વર્ષ લાગુ થશે.</p>
            </div>
          </div>

          {headers.length > 0 && !parseError && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-700 mb-1">
                મળેલા હેડર (Detected columns): <span className="text-gray-500">{matrix.length} data rows</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {headers.map((h, idx) => (
                  <span key={idx} className="chip cursor-default bg-gray-100 text-gray-700 border-gray-300">
                    {String(h).trim() || `(column ${idx + 1})`}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-5">
            <button className="btn-primary" disabled={!step1Valid} onClick={() => setStep(2)}>
              આગળ (Next) →
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 2: MAP COLUMNS ---------- */}
      {step === 2 && (
        <div className="card">
          <p className="text-sm text-gray-600 mb-3">
            દરેક કૉલમ ને સિસ્ટમ ફીલ્ડ સાથે જોડો. <strong>નામ (Name)</strong> અને <strong>રકમ (Amount)</strong> જરૂરી છે.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4">ફાઈલની કૉલમ (Source column)</th>
                  <th className="py-2 pr-4">નમૂનો (Sample)</th>
                  <th className="py-2">સિસ્ટમ ફીલ્ડ (Maps to)</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{String(h).trim() || `(column ${idx + 1})`}</td>
                    <td className="py-2 pr-4 text-gray-500 truncate max-w-[12rem]">
                      {matrix[0] ? String(matrix[0][idx] ?? '') : ''}
                    </td>
                    <td className="py-2">
                      <select
                        className="input py-2"
                        value={mapping[idx] ?? IGNORE}
                        onChange={(e) => setColumnMap(idx, e.target.value)}
                      >
                        <option value={IGNORE}>(અવગણો / ignore)</option>
                        {SYSTEM_FIELDS.map((sf) => (
                          <option key={sf} value={sf}>
                            {FIELD_LABELS[sf]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <FieldError>{mapError}</FieldError>

          <div className="flex justify-between mt-5">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              ← પાછળ (Back)
            </button>
            <button className="btn-primary" onClick={goFromMapping}>
              આગળ (Next) →
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP 3: PREVIEW & FIX ---------- */}
      {step === 3 && (
        <div className="card">
          {validateMut.isPending && <Loading label="ચકાસણી થઈ રહી છે… (Validating…)" />}
          {validateMut.error && <ErrorState error={validateMut.error} onRetry={() => validateMut.mutate()} />}

          {!validateMut.isPending && !validateMut.error && (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                <Chip label="કુલ (Total)" value={summary.total} tone="default" />
                <Chip label="માન્ય (Valid)" value={summary.valid} tone="green" />
                <Chip label="ડુપ્લિકેટ (Duplicates)" value={summary.duplicates} tone="amber" />
                <Chip label="ભૂલ (Errors)" value={summary.errors} tone="red" />
              </div>

              {previewRows.length === 0 ? (
                <p className="text-gray-500 py-6 text-center">કોઈ રો મળી નથી. (No rows to preview.)</p>
              ) : (
                <>
                  {errorReportRows.length > 0 && (
                    <div className="mb-3">
                      <button
                        className="btn-secondary"
                        onClick={() => downloadErrorReport(errorReportRows, 'import_errors.csv')}
                      >
                        ભૂલ રિપોર્ટ ડાઉનલોડ (Download error report CSV)
                      </button>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-2 pr-3">#</th>
                          <th className="py-2 pr-3">નામ (Name)</th>
                          <th className="py-2 pr-3">ગામ (Village)</th>
                          <th className="py-2 pr-3">રકમ (Amount)</th>
                          <th className="py-2 pr-3">વર્ષ (Year)</th>
                          <th className="py-2 pr-3">સ્થિતિ (Status)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r) => {
                          const hasError = r.errors && r.errors.length > 0;
                          return (
                            <tr
                              key={r._row}
                              className={
                                'border-b last:border-0 align-top ' +
                                (hasError ? 'bg-red-50' : r.alreadyImported ? 'bg-amber-50' : '')
                              }
                            >
                              <td className="py-2 pr-3 text-gray-500">{r._row}</td>
                              <td className="py-2 pr-3">{r.name || <span className="text-red-600">—</span>}</td>
                              <td className="py-2 pr-3">{r.village || '—'}</td>
                              <td className="py-2 pr-3">{r.amount === '' || r.amount == null ? '—' : inr(r.amount)}</td>
                              <td className="py-2 pr-3">{r.year || '—'}</td>
                              <td className="py-2 pr-3">
                                {hasError && <div className="text-red-700">{r.errors.join('; ')}</div>}
                                {!hasError && r.alreadyImported && (
                                  <div className="text-amber-700">પહેલેથી ઈમ્પોર્ટ થયેલ (already imported — will skip)</div>
                                )}
                                {!hasError && !r.alreadyImported && <div className="text-green-700">માન્ય (valid)</div>}
                                {r.duplicateDonor && (
                                  <label className="mt-1 flex items-center gap-2 text-gray-700">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(useExisting[r._row])}
                                      onChange={() => toggleUseExisting(r)}
                                    />
                                    <span>
                                      matches existing: <strong>{r.duplicateDonor.name}</strong>
                                      {r.duplicateDonor.village ? ` (${r.duplicateDonor.village})` : ''} — use existing donor
                                    </span>
                                  </label>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <div className="flex justify-between mt-5">
                <button className="btn-secondary" onClick={() => setStep(2)}>
                  ← પાછળ (Back)
                </button>
                <button className="btn-primary" disabled={summary.valid === 0} onClick={() => setConfirmOpen(true)}>
                  ઈમ્પોર્ટ કરો (Import {summary.valid}) →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- STEP 5: RESULT ---------- */}
      {step === 5 && (
        <div className="card max-w-2xl">
          {commitMut.error ? (
            <ErrorState error={commitMut.error} onRetry={() => setStep(3)} />
          ) : (
            <>
              <h2 className="text-lg font-bold mb-3">ઈમ્પોર્ટ પૂર્ણ (Import complete)</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                <Chip label="ઈમ્પોર્ટ થયેલ (Imported)" value={result?.imported ?? 0} tone="green" />
                <Chip label="ડુપ્લિકેટ છોડ્યા (Skipped duplicates)" value={result?.skippedDuplicates ?? 0} tone="amber" />
                <Chip label="ભૂલ છોડી (Skipped errors)" value={result?.skippedErrors ?? 0} tone="red" />
              </div>
              <p className="text-sm text-gray-500">
                નોંધ: એ જ ફાઈલ ફરી ઈમ્પોર્ટ કરવાથી 0 નવી રો ઉમેરાશે. (Re-importing the same file imports 0 new rows.)
              </p>

              {Array.isArray(result?.errorRows) && result.errorRows.length > 0 && (
                <div className="mt-4">
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      downloadErrorReport(
                        result.errorRows.map((r) => ({
                          row: r._row,
                          name: r.name,
                          amount: r.amount,
                          year: '',
                          village: '',
                          status: 'skipped',
                          errors: r.reason || '',
                        })),
                        'import_skipped_rows.csv'
                      )
                    }
                  >
                    છોડેલી રો ડાઉનલોડ (Download error report)
                  </button>
                </div>
              )}

              <div className="mt-5">
                <button className="btn-primary" onClick={resetAll}>
                  બીજી ફાઈલ ઈમ્પોર્ટ કરો (Import another file)
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------- STEP 4: CONFIRM DIALOG ---------- */}
      <ConfirmDialog
        open={confirmOpen}
        title="ઈમ્પોર્ટની ખાતરી કરો (Confirm import)"
        message={`યોજના: ${schemeName || '—'} • વર્ષ: ${year}`}
        detail={
          <div>
            <div>{summary.valid} will import</div>
            <div>{summary.duplicates} duplicates skipped</div>
            <div>{summary.errors} errors skipped</div>
          </div>
        }
        confirmLabel={`ઈમ્પોર્ટ ${summary.valid}`}
        busy={commitMut.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => commitMut.mutate()}
      />
    </div>
  );
}
