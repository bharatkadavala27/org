import { t } from '../lib/i18n';

// Confirm dialog for irreversible / money / permission actions.
// Shows exactly what will happen.
export default function ConfirmDialog({ open, title, message, detail, confirmLabel, danger, onConfirm, onCancel, busy }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        {message && <p className="text-gray-700">{message}</p>}
        {detail && <div className="mt-3 bg-gray-50 border rounded-lg p-3 text-sm text-gray-800">{detail}</div>}
        <div className="flex gap-3 mt-5 justify-end">
          <button className="btn-secondary" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? t.loading : confirmLabel || t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
