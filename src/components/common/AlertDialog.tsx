import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
// Shares the modal look of the delete confirmation.
import './ConfirmDialog.css'

interface AlertDialogProps {
  title: string
  /** Picks the icon and its colour. */
  kind: 'offline' | 'error'
  children: ReactNode
  buttonLabel?: string
  onClose: () => void
}

/**
 * One-button modal for something the user must acknowledge (no internet,
 * a save the server refused). Mount it only while it should be visible.
 * Escape or the button closes it; clicking the backdrop does not.
 */
export function AlertDialog({ title, kind, children, buttonLabel = 'OK', onClose }: AlertDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    buttonRef.current?.focus()
  }, [])

  return createPortal(
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onClose={onClose}
    >
      <div className="confirm-dialog__body">
        <div className="confirm-dialog__header">
          <span className={`confirm-dialog__icon confirm-dialog__icon--${kind}`} aria-hidden="true">
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
              {kind === 'offline' ? (
                <>
                  <path d="M2 2l20 20" />
                  <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                  <path d="M5 12.9a10 10 0 0 1 5.2-2.8" />
                  <path d="M19 12.9a10 10 0 0 0-2.3-1.6" />
                  <path d="M2 8.8a15 15 0 0 1 4.2-2.6" />
                  <path d="M22 8.8a15 15 0 0 0-11.3-3.7" />
                  <path d="M12 20h.01" />
                </>
              ) : (
                <>
                  <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </>
              )}
            </svg>
          </span>
          <h2 id={titleId} className="confirm-dialog__title">
            {title}
          </h2>
        </div>

        <div id={messageId} className="confirm-dialog__message">
          {children}
        </div>

        <div className="confirm-dialog__actions">
          <button ref={buttonRef} type="button" className="btn btn-primary" onClick={onClose}>
            {buttonLabel}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}
