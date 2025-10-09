import { toastStyles as toastVariantStyles } from '../constants/ui.js';

export function Toast({ toast, onClose }) {
  if (!toast) return null;

  const style = toastVariantStyles[toast.type] || toastVariantStyles.info;

  return (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div className={`max-w-xl w-full rounded-3xl border px-5 py-4 text-sm font-medium backdrop-blur ${style}`}>
        <div className="flex items-start justify-between gap-4">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-wide text-slate-300/70 hover:text-slate-100"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

export default Toast;
