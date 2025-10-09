export const formatRelative = (timestamp) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '-';
  const now = new Date();
  const diffMinutes = Math.floor((now - date) / (1000 * 60));
  if (diffMinutes < 1) return 'Ora';
  if (diffMinutes < 60) return `${diffMinutes}m fa`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h fa`;
  return `${date.toLocaleDateString('it-IT')} ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatAbsolute = (timestamp) => {
  if (!timestamp) return '--';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--';
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
