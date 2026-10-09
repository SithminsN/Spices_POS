import { useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import type { ConfirmDialogProps } from './ConfirmDialog'
import './ConfirmButton.css'

type ConfirmButtonProps = Omit<ConfirmDialogProps, 'onCancel'> & {
  /** 'icon': small icon-only control for a row action. 'button': full-width labeled danger button. */
  variant?: 'icon' | 'button'
  /** Button text ('button' variant) or accessible name/tooltip ('icon' variant). */
  label?: string
  className?: string
}

/**
 * Trigger used for every destructive action in the app. Clicking it opens a
 * ConfirmDialog; onConfirm runs only when the user confirms there (yes/no,
 * or typing `typeToConfirm` first -- used for product delete). Cancelling
 * changes nothing. Replaces window.confirm/alert.
 */
export function ConfirmButton({
  variant = 'icon',
  label = 'Delete',
  className = '',
  onConfirm,
  ...dialogProps
}: ConfirmButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleConfirm() {
    setIsOpen(false)
    onConfirm()
  }

  function handleCancel() {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const trigger =
    variant === 'button' ? (
      <button
        ref={triggerRef}
        type="button"
        className={`btn btn-danger btn-block ${className}`.trim()}
        onClick={() => setIsOpen(true)}
      >
        {label}
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        className={`btn-icon confirm-btn-icon ${className}`.trim()}
        onClick={() => setIsOpen(true)}
        aria-label={label}
        title={label}
      >
        <span className="confirm-btn-icon-glyph" aria-hidden="true">
          🗑
        </span>
      </button>
    )

  return (
    <>
      {trigger}
      {isOpen && <ConfirmDialog {...dialogProps} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </>
  )
}
