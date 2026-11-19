import { useCallback, useRef, useState } from 'react';

export function useLoadingActions() {
  const [loadingActions, setLoadingActions] = useState<ReadonlySet<string>>(() => new Set());
  const activeActions = useRef(new Set<string>());

  const startLoading = useCallback((action: string) => {
    if (activeActions.current.has(action)) return false;
    activeActions.current.add(action);
    setLoadingActions(current => new Set(current).add(action));
    return true;
  }, []);

  const stopLoading = useCallback((action: string) => {
    if (!activeActions.current.delete(action)) return;
    setLoadingActions(current => {
      const next = new Set(current);
      next.delete(action);
      return next;
    });
  }, []);

  const isLoading = useCallback((action: string) => loadingActions.has(action), [loadingActions]);

  return { isLoading, startLoading, stopLoading };
}
