/**
 * Toast context — provides toast notification functionality to the entire app.
 * Wrap the app with ToastProvider and use useToastContext() in any component.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useToast } from '../hooks/useToast';
import type { UseToastReturn, Toast } from '../hooks/useToast';
import { ToastContainer } from '../components/ToastContainer';

const ToastContext = createContext<UseToastReturn | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const toastState = useToast();

  return (
    <ToastContext.Provider value={toastState}>
      {children}
      <ToastContainer toasts={toastState.toasts} onDismiss={toastState.removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to access toast notifications from any component.
 * Must be used within a ToastProvider.
 */
export function useToastContext(): UseToastReturn {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within a ToastProvider');
  }
  return context;
}

// Re-export types for convenience
export type { Toast, UseToastReturn };
