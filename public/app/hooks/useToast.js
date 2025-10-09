const {
  useState: useReactState,
  useEffect: useReactEffect,
  useCallback: useReactCallback
} = React;

export function useToast(autoDismissMs = 5000) {
  const [toast, setToast] = useReactState(null);

  useReactEffect(() => {
    if (!toast) return undefined;
    const timeout = setTimeout(() => setToast(null), autoDismissMs);
    return () => clearTimeout(timeout);
  }, [toast, autoDismissMs]);

  const showToast = useReactCallback((nextToast) => {
    setToast(nextToast);
  }, []);

  const hideToast = useReactCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}
