(() => {
  window.MusicBee = window.MusicBee || {};

  const API_BASE = `${window.location.origin}/api/v1`;
  const statusBadgeClasses = {
    online: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
    idle: 'bg-amber-400/15 text-amber-200 border border-amber-500/30',
    offline: 'bg-rose-500/15 text-rose-200 border border-rose-500/40'
  };
  const toastStyles = {
    success: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100 shadow-soft',
    error: 'border-rose-500/60 bg-rose-500/20 text-rose-100 shadow-soft',
    info: 'border-sky-500/50 bg-sky-500/15 text-sky-100 shadow-soft'
  };

  window.MusicBee.constants = {
    API_BASE,
    statusBadgeClasses,
    toastStyles
  };
})();
