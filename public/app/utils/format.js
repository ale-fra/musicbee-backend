const isValidDate = (value) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) ? date : null;
};

export const formatRelativeTime = (timestamp) => {
  const date = isValidDate(timestamp);
  if (!date) return '-';

  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  if (diffMinutes < 1) return 'Ora';
  if (diffMinutes < 60) return `${diffMinutes}m fa`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h fa`;
  return `${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

export const formatAbsoluteDate = (timestamp) => {
  const date = isValidDate(timestamp);
  if (!date) return '--';

  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatNumber = (value) => {
  if (value === null || value === undefined) return '--';
  return new Intl.NumberFormat('it-IT').format(value);
};

export const formatNumberCompact = (value) => {
  if (value === null || value === undefined) return '--';

  const number = Number(value);
  if (Number.isNaN(number)) return '--';

  return new Intl.NumberFormat('it-IT', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: number >= 100 ? 0 : 1
  }).format(number);
};

// Legacy exports kept for compatibility with any remaining modules that still
// reference the previous helper names. They simply forward to the new
// implementations above.
export const formatRelative = formatRelativeTime;
export const formatAbsolute = formatAbsoluteDate;
