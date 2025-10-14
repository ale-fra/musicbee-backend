(() => {
  window.MusicBee = window.MusicBee || {};
  window.MusicBee.components = window.MusicBee.components || {};

  const ProgressBar = ({ label, value, percent, gradient }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-semibold text-slate-100">{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-800/80">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: gradient }}
        />
      </div>
    </div>
  );

  window.MusicBee.components.ProgressBar = ProgressBar;
})();
