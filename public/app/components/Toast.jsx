window.MusicBee = window.MusicBee || {};
window.MusicBee.components = window.MusicBee.components || {};

const { toastStyles } = window.MusicBee.constants;

const Toast = ({ toast, onClose }) => {
  if (!toast) return null;

  return (
    <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <div className={`max-w-xl w-full rounded-3xl border px-5 py-4 text-sm font-medium backdrop-blur ${toastStyles[toast.type] || toastStyles.info}`}>
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
};

window.MusicBee.components.Toast = Toast;
