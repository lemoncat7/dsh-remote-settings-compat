export interface RecoveryConnection {
  state?: { getSnapshot(): string | undefined; subscribe(listener: () => void): () => void }
  reconnect?(): void
}

export function isExpiredGateResponse(value: unknown): boolean {
  return value !== null && typeof value === 'object'
    && (value as { gateway?: unknown }).gateway === 'dsh-access-gate'
    && (value as { authenticated?: unknown }).authenticated === false
}

/** Observe the official connection; never replace WebSocket or own its retry loop. */
export function watchGateAuthentication(connection: RecoveryConnection): () => void {
  let disposed = false
  let pending = false
  let lastCheck = 0
  let notice: HTMLElement | undefined
  let request: AbortController | undefined
  const check = async () => {
    if (disposed || pending || document.hidden || Date.now() - lastCheck < 5_000) return
    if (!notice && connection.state?.getSnapshot() === 'connected') return
    pending = true
    lastCheck = Date.now()
    request = new AbortController()
    const timeout = setTimeout(() => request?.abort(), 5_000)
    try {
      const response = await fetch('/__dsh_access/status', {
        credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: request.signal,
      })
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return
      const value: unknown = await response.json()
      if (disposed) return
      if (isExpiredGateResponse(value)) {
        notice ??= showExpiredNotice()
      } else if (value !== null && typeof value === 'object'
        && (value as { gateway?: unknown }).gateway === 'dsh-access-gate'
        && (value as { authenticated?: unknown }).authenticated === true && notice) {
        notice.remove()
        notice = undefined
        if (connection.state?.getSnapshot() !== 'connected') connection.reconnect?.()
      }
    } catch {
      // Offline, timeout, native entry, and proxy failures are not authentication failures.
    } finally {
      clearTimeout(timeout)
      pending = false
    }
  }
  const trigger = () => { void check() }
  const unsubscribe = connection.state?.subscribe(trigger)
  const timer = setInterval(trigger, 10_000)
  window.addEventListener('focus', trigger)
  document.addEventListener('visibilitychange', trigger)
  trigger()
  return () => {
    disposed = true
    clearInterval(timer)
    request?.abort()
    unsubscribe?.()
    window.removeEventListener('focus', trigger)
    document.removeEventListener('visibilitychange', trigger)
    notice?.remove()
  }
}

function showExpiredNotice(): HTMLElement {
  const host = document.createElement('aside')
  host.dataset.dshAccessExpired = 'true'
  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = `
    :host { position:fixed; z-index:10000; top:max(12px,env(safe-area-inset-top)); right:12px;
      width:min(360px,calc(100vw - 24px)); font:14px/1.5 system-ui,sans-serif; color-scheme:light dark; }
    section { padding:16px; border:1px solid GrayText; border-radius:12px;
      background:Canvas; color:CanvasText; box-shadow:0 4px 18px #0002; }
    p { margin:0 0 8px; } a { color:LinkText; display:inline-flex; align-items:center; min-height:44px; }
    a:focus-visible { outline:2px solid LinkText; outline-offset:3px; border-radius:3px; }
  `
  const section = document.createElement('section')
  section.setAttribute('role', 'status')
  const message = document.createElement('p')
  message.textContent = '远程登录已失效，重新登录后才能恢复连接。当前页面和未发送内容会保留。'
  const link = document.createElement('a')
  link.href = '/__dsh_access/login'
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  link.textContent = '重新登录（新标签页）'
  section.append(message, link)
  root.append(style, section)
  document.body.append(host)
  return host
}
