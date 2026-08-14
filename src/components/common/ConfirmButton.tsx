import { useEffect, useRef, useState } from 'react'
import './ConfirmButton.css'

const CONFIRM_TIMEOUT_MS = 3000

interface ConfirmButtonProps {
  onConfirm: () => void
  /** 'icon': small icon-only control for a row action. 'button': full-width labeled danger button. */
  variant?: 'icon' | 'button'
  label?: string
  confirmLabel?: string
  className?: string
}

/**
 * Tap-to-confirm control used for every destructive action in the app.
 * First click arms a ~3s "confirming" state; a second click within that
 * window fires onConfirm(). No click before the timeout silently reverts —
 * onConfirm is never called on its own. Replaces window.confirm/alert.
 */
export function ConfirmButton({
  onConfirm,
  variant = 'icon',
  label = 'Delete',
  confirmLabel = 'Confirm?',
  className = '',
}: ConfirmButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function handleClick() {
    if (confirming) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = null
      setConfirming(false)
      onConfirm()
      return
    }
    setConfirming(true)
    timeoutRef.current = setTimeout(() => {
      setConfirming(false)
      timeoutRef.current = null
    }, CONFIRM_TIMEOUT_MS)
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`btn btn-danger btn-block confirm-btn ${confirming ? 'is-confirming' : ''} ${className}`.trim()}
        onClick={handleClick}
      >
        {confirming ? confirmLabel : label}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`btn-icon confirm-btn-icon ${confirming ? 'is-confirming' : ''} ${className}`.trim()}
      onClick={handleClick}
      aria-label={confirming ? confirmLabel : label}
      title={confirming ? confirmLabel : label}
    >
      {confirming ? (
        <span className="confirm-btn-icon-text">{confirmLabel}</span>
      ) : (
        <span className="confirm-btn-icon-glyph" aria-hidden="true">
          🗑
        </span>
      )}
    </button>
  )
}
