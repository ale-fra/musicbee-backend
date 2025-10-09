window.MusicBee = window.MusicBee || {};
window.MusicBee.components = window.MusicBee.components || {};

const StatCard = ({ label, value, hint, accent }) => (
  <div className="rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-card backdrop-blur">
    <p className="text-sm font-medium text-slate-400">{label}</p>
    <p className={`mt-2 text-3xl font-semibold ${accent || 'text-slate-100'}`}>{value}</p>
    {hint && <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">{hint}</p>}
  </div>
);

window.MusicBee.components.StatCard = StatCard;
