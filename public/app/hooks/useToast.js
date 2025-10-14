(() => {
  window.MusicBee = window.MusicBee || {};
  window.MusicBee.hooks = window.MusicBee.hooks || {};

  const { useState, useEffect, useCallback } = React;
  const DEFAULT_TIMEOUT = 5000;

  const normalizeToast = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      return { type: 'info', message: value };
    }
    return value;
  };

  const useToast = () => {
    const [toast, setToast] = useState(null);

    useEffect(() => {
      if (!toast) return undefined;
      const timeout = setTimeout(() => setToast(null), toast.duration || DEFAULT_TIMEOUT);
      return () => clearTimeout(timeout);
    }, [toast]);

    const showToast = useCallback((nextToast) => {
      setToast(normalizeToast(nextToast));
    }, []);

    const hideToast = useCallback(() => setToast(null), []);

    return { toast, showToast, hideToast };
  };

  window.MusicBee.hooks.useToast = useToast;
})();
