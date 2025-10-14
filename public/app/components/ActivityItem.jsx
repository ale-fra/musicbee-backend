(() => {
  window.MusicBee = window.MusicBee || {};
  window.MusicBee.components = window.MusicBee.components || {};

  const { formatRelative } = window.MusicBee.utils;

  const ActivityItem = ({ item }) => {
    const icon = item.action === 'play' ? '🎧' : '📡';
    const badgeClass = item.type === 'unknown'
      ? 'bg-amber-500/15 text-amber-200 border border-amber-400/40'
      : 'bg-sky-500/15 text-sky-100 border border-sky-500/30';
    const actionLabel = item.action === 'play' ? 'Riproduzione' : 'Scan';

    return (
      <li className="flex items-center gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
        <span className="text-xl">{icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-slate-100">{item.title || item.cardId}</p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
            <span>ID: {item.cardId}</span>
            <span>{formatRelative(item.timestamp)}</span>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}>
          {actionLabel}
        </span>
      </li>
    );
  };

  window.MusicBee.components.ActivityItem = ActivityItem;
})();
