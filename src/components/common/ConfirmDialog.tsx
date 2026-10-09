import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmDialog.css'

export interface ConfirmDialogProps {
  /** Heading, e.g. "Delete transaction?" */
  title: string
  /** Summary of exactly what will be affected, shown in a highlighted box. */
  details?: ReactNode
  /** The consequences, shown under the details. */
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** If set, the confirm button stays disabled until this exact text is typed (product delete). */
  typeToConfirm?: string
  onConfirm: () => void
  onCancel: () => void
}

/** NFC + trim, so text typed with a different input method (e.g. Sinhala) still matches. */
function normalizeTyped(text: string): string {
  return text.normalize('NFC').trim()
}

/**
 * Modal confirmation for destructive actions. Mount it only while it should
 * be visible -- it opens itself on mount. Uses the native <dialog> with
 * showModal(), which gives the backdrop, makes the page behind it inert, and
 * handles Escape (reported through onCancel via the close event).
 */
export function ConfirmDialog({
  title,
  details,
  message,
  confirmLabel = 'Yes, delete',
  cancelLabel = 'No, keep it',
  typeToConfirm,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const pointerDownOnBackdrop = useRef(false)
  const [typed, setTyped] = useState('')
  const titleId = useId()
  const messageId = useId()
  const inputId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    // Typed confirmation starts in the input; yes/no starts on the safe choice.
    const initialFocus = inputRef.current ?? cancelRef.current
    initialFocus?.focus()
  }, [])

  const canConfirm = typeToConfirm == null || normalizeTyped(typed) === normalizeTyped(typeToConfirm)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canConfirm) onConfirm()
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClose={onCancel}
      // The dialog has no padding, so a click whose target is the dialog
      // itself landed on the backdrop. Requiring the press to start there too
      // stops a text selection dragged out of the input from cancelling.
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pointerDownOnBackdrop.current && event.target === event.currentTarget) onCancel()
      }}
    >
      <form className="confirm-dialog__body" onSubmit={handleSubmit}>
        <div className="confirm-dialog__header">
          <span className="confirm-dialog__icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </span>
          <h2 id={titleId} className="confirm-dialog__title">
            {title}
          </h2>
        </div>

        {details != null && <div className="confirm-dialog__details">{details}</div>}

        <p id={messageId} className="confirm-dialog__message">
          {message}
        </p>

        {typeToConfirm != null && (
          <div className="field">
            <label htmlFor={inputId}>
              Type <strong>{typeToConfirm}</strong> to confirm
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        )}

        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit" className="btn btn-danger" disabled={!canConfirm}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  )
}
