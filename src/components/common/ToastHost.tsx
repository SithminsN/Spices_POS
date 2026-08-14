import { useToast } from '../../context/ToastContext'
import './ToastHost.css'

/** Renders the active toast queue from ToastContext. Mount once, in App.tsx. */
export function ToastHost() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className={`toast toast-${toast.variant}`}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
