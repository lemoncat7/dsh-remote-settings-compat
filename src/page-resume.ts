import type { RecoveryConnection } from './access/auth-recovery.js'

/** A BFCache-restored document retains JS state, but not its old WebSocket. */
export function watchPageResume(connection: RecoveryConnection, win: Window = window): () => void {
  const resume = (event: PageTransitionEvent) => {
    if (event.persisted) connection.reconnect?.()
  }
  win.addEventListener('pageshow', resume)
  return () => win.removeEventListener('pageshow', resume)
}
