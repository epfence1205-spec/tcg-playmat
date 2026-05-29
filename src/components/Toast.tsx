/**
 * Individual toast notification component.
 * Renders a non-blocking notification with optional action button.
 */

import type { Toast as ToastData } from '../hooks/useToast';

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastData['type'], string> = {
  error: 'border-red-500/60 bg-red-950/90 text-red-100',
  warning: 'border-amber-500/60 bg-amber-950/90 text-amber-100',
  info: 'border-blue-500/60 bg-blue-950/90 text-blue-100',
};

const iconPaths: Record<ToastData['type'], string> = {
  error:
    'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  warning:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  info: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
};

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm min-w-[300px] max-w-[420px] animate-slide-in ${typeStyles[toast.type]}`}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <svg
        className="w-5 h-5 shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[toast.type]} />
      </svg>

      {/* Message */}
      <p className="text-sm flex-1">{toast.message}</p>

      {/* Action button (optional) */}
      {toast.action && (
        <button
          type="button"
          className="text-sm font-medium underline underline-offset-2 hover:opacity-80 shrink-0"
          onClick={toast.action.onClick}
        >
          {toast.action.label}
        </button>
      )}

      {/* Dismiss button */}
      <button
        type="button"
        className="text-current opacity-60 hover:opacity-100 shrink-0"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
