import { formatNumber as formatNumberCompact } from '../utils/format.js';

export function CardItem({ card, onPlay, onDelete, onAssign, formatRelative }) {
  const usage = card.usage || {};
  const scanCount = usage.scanCount || 0;
  const playCount = usage.playCount || 0;
  const isUnknown = card.type === 'unknown';
  const hasSource = Boolean(card.source);
  const canPlay = hasSource && !isUnknown;
  const chipClass = isUnknown
    ? 'bg-amber-500/15 text-amber-200 border border-amber-400/40'
    : 'bg-sky-500/15 text-sky-100 border border-sky-500/30';

  return (
    <article className={`flex flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-soft transition hover:border-sky-500/40 hover:shadow-card ${isUnknown ? 'ring-1 ring-amber-500/30' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${chipClass}`}>
          ID {card.cardId}
        </span>
        <span className="text-xs font-medium text-slate-400">{isUnknown ? 'Non configurata' : (card.type || '–')}</span>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-100">{card.title || `Carta ${card.cardId}`}</h3>
        <p className="mt-1 text-sm text-slate-400">
          {hasSource ? 'File associato' : 'Nessun file associato'}
        </p>
        {hasSource && (
          <p className="mt-1 truncate text-sm text-slate-300" title={card.source}>{card.source}</p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Scan</dt>
          <dd className="mt-1 text-slate-100">{formatNumberCompact(scanCount)}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Riproduzioni</dt>
          <dd className="mt-1 text-slate-100">{formatNumberCompact(playCount)}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-3 col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Ultimo scan</dt>
          <dd className="mt-1 text-slate-100">{usage.lastScannedAt ? formatRelative(usage.lastScannedAt) : 'Mai scansionata'}</dd>
        </div>
        <div className="rounded-2xl border border-slate-800/50 bg-slate-900/40 p-3 col-span-2">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Ultima riproduzione</dt>
          <dd className="mt-1 text-slate-100">{usage.lastPlayedAt ? formatRelative(usage.lastPlayedAt) : 'Mai riprodotta'}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onPlay(card.cardId)}
          disabled={!canPlay}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500/90 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700/80 disabled:text-slate-400"
        >
          ▶️ Riproduci
        </button>
        <button
          type="button"
          onClick={() => onAssign(card.cardId)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-sky-400 hover:text-sky-300"
        >
          📎 Associa file
        </button>
        <button
          type="button"
          onClick={() => onDelete(card.cardId)}
          className="ml-auto inline-flex items-center justify-center gap-2 rounded-full bg-rose-500/90 px-4 py-2 text-sm font-semibold text-rose-50 transition hover:bg-rose-400"
        >
          🗑️ Elimina
        </button>
      </div>
    </article>
  );
}

export default CardItem;
