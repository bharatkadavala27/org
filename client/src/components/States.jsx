import { t } from '../lib/i18n';

export function Loading({ label }) {
  return (
    <div className="flex items-center justify-center py-10 text-gray-500" role="status" aria-live="polite">
      <svg className="animate-spin h-6 w-6 mr-2 text-brand" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      {label || t.loading}
    </div>
  );
}

export function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-12 text-gray-500">
      <p className="text-lg font-medium">{title || t.noData}</p>
      {hint && <p className="text-sm mt-1">{hint}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const msg = typeof error === 'string' ? error : error?.message || t.error;
  return (
    <div className="text-center py-10">
      <p className="text-red-600 font-medium">{msg}</p>
      {onRetry && (
        <button className="btn-secondary mt-3" onClick={onRetry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 mt-1">{children}</p>;
}
