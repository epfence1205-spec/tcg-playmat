/**
 * Toast notification state management hook.
 * Provides add/remove functionality for non-blocking toast notifications.
 */

import { useState, useCallback, useRef } from 'react';

export type ToastType = 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Optional action button (e.g., "Retry") */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/** Duration in ms before a toast auto-dismisses */
const AUTO_DISMISS_MS = 5000;

export interface UseToastReturn {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

/**
 * Hook for managing toast notifications.
 * Toasts auto-dismiss after ~5 seconds unless they have an action button.
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = crypto.randomUUID();
      const newToast: Toast = { ...toast, id };

      setToasts((prev) => [...prev, newToast]);

      // Auto-dismiss after 5 seconds (even toasts with actions auto-dismiss)
      const timer = setTimeout(() => {
        removeToast(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);

      return id;
    },
    [removeToast]
  );

  return { toasts, addToast, removeToast };
}
