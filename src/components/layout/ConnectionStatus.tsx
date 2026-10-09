import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../context/AppDataContext'
import { useToast } from '../../context/ToastContext'
import { AlertDialog } from '../common/AlertDialog'
import './ConnectionStatus.css'

/** A save normally reaches the server in well under a second; mention it only after this. */
const SLOW_SAVE_NOTICE_MS = 10_000
/** How long a connection problem lasts before a modal interrupts. */
const ALERT_AFTER_MS = 60_000

/**
 * Tells the user when changes are only on this device:
 * - a banner while offline, or while saving to the server is slow;
 * - a modal once that has lasted ALERT_AFTER_MS (once per outage);
 * - a modal right away if the server refused a save (it was undone);
 * - a toast once everything has reached the server again.
 * Offline writes are not lost -- Firestore keeps them on the device and
 * sends them later (see data/firestoreSync.ts).
 */
export function ConnectionStatus() {
  const { offlineSince, unsyncedSince, saveErrors, dismissSaveErrors } = useAppData()
  const { showToast } = useToast()
  const [, setTick] = useState(0)
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [episodeActive, setEpisodeActive] = useState(false)
  const [reconnectedAt, setReconnectedAt] = useState<number | null>(null)
  const wasOffline = useRef(offlineSince != null)

  const isOffline = offlineSince != null
  const hasProblem = isOffline || unsyncedSince != null

  // Re-render every second while there's a problem so the time thresholds are noticed.
  useEffect(() => {
    if (!hasProblem) return
    const timer = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [hasProblem])

  // Time spent waiting for the server only counts from when we're back online.
  useEffect(() => {
    if (offlineSince != null) {
      wasOffline.current = true
    } else if (wasOffline.current) {
      wasOffline.current = false
      setReconnectedAt(Date.now())
    }
  }, [offlineSince])

  const now = Date.now()
  const waitingSince = !isOffline && unsyncedSince != null ? Math.max(unsyncedSince, reconnectedAt ?? 0) : null
  const isSlow = waitingSince != null && now - waitingSince >= SLOW_SAVE_NOTICE_MS
  const banner = isOffline ? 'offline' : unsyncedSince != null && (isSlow || episodeActive) ? 'uploading' : null
  const alert =
    alertDismissed
      ? null
      : offlineSince != null && now - offlineSince >= ALERT_AFTER_MS
        ? 'offline'
        : waitingSince != null && now - waitingSince >= ALERT_AFTER_MS
          ? 'unreachable'
          : null

  useEffect(() => {
    if (banner != null && !episodeActive) setEpisodeActive(true)
  }, [banner, episodeActive])

  // Problem over: everything queued has reached the server.
  useEffect(() => {
    if (hasProblem) return
    if (episodeActive) showToast('Back online — all changes are saved')
    setEpisodeActive(false)
    setAlertDismissed(false)
  }, [hasProblem, episodeActive, showToast])

  const untilThen = (
    <>
      <p>Until then:</p>
      <ul>
        <li>
          Keep using <strong>this device</strong> — entries made here won’t show on other devices yet.
        </li>
        <li>
          <strong>Don’t clear this browser’s data</strong>, and keep the app open if you can.
        </li>
      </ul>
    </>
  )

  return (
    <>
      {banner != null && (
        <div className={`connection-banner connection-banner--${banner}`} role="status">
          {banner === 'offline' ? (
            <>
              <strong>No internet.</strong> You can keep working — changes are kept on this device and upload
              when the connection is back.
            </>
          ) : (
            <>
              <strong>Uploading changes…</strong> They’re kept on this device until the server confirms them.
            </>
          )}
        </div>
      )}

      {alert === 'offline' && (
        <AlertDialog title="No internet connection" kind="offline" buttonLabel="OK, got it" onClose={() => setAlertDismissed(true)}>
          <p>This device has been offline for over a minute.</p>
          <p>
            Your entries are kept on this device and <strong>upload automatically</strong> when the internet comes
            back.
          </p>
          {untilThen}
        </AlertDialog>
      )}

      {alert === 'unreachable' && (
        <AlertDialog
          title="Changes aren’t reaching the server"
          kind="offline"
          buttonLabel="OK, got it"
          onClose={() => setAlertDismissed(true)}
        >
          <p>
            For over a minute, changes from this device haven’t reached the server — the Wi-Fi may be connected
            without working internet.
          </p>
          <p>
            They’re kept on this device and <strong>upload automatically</strong> once the server can be reached.
          </p>
          {untilThen}
        </AlertDialog>
      )}

      {saveErrors.length > 0 && (
        <AlertDialog
          title={saveErrors.length === 1 ? 'A change wasn’t saved' : `${saveErrors.length} changes weren’t saved`}
          kind="error"
          onClose={dismissSaveErrors}
        >
          <p>
            The server refused {saveErrors.length === 1 ? 'it, so it was' : 'them, so they were'} undone on this
            device. <strong>Please check and enter {saveErrors.length === 1 ? 'it' : 'them'} again.</strong>
          </p>
          <ul>
            {saveErrors.map((error) => (
              <li key={error.id}>
                {error.action} <span className="connection-error-detail">({error.detail})</span>
              </li>
            ))}
          </ul>
        </AlertDialog>
      )}
    </>
  )
}
