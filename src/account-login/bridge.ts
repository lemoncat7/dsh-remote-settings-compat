import { createHash } from 'node:crypto'

// A narrow structural port for the official 0.2.1 Account service. No grants,
// tokens or PKCE secrets cross this adapter; credential ownership stays native.
export interface AccountAttempt {
  id: string
  phase: string
  authorizeUrl?: string
  expiresAt?: number
  errorCode?: string
}
export interface AccountState { status: string; attempt: AccountAttempt | null }
export interface AccountPort {
  getState(): Promise<AccountState>
  startSignIn(client: { version: string; locale: string; timezoneOffsetSeconds: number }, origin: string, source: 'web'): Promise<AccountState>
  cancelSignIn(id: string): Promise<AccountState>
}
export interface LoginView {
  phase: string
  attemptId?: string
  authorizeUrl?: string
  callbackOrigin?: string
  expiresAt?: number
  message?: string
}
interface Lease { owner: string; id: string; origin: string; expiresAt: number; submitted: boolean; error?: string }
const active = (phase: string) => ['initializing', 'waiting-browser', 'exchanging', 'committing'].includes(phase)
const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export class BridgeError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}
export const fail = (status: number, message: string) => new BridgeError(status, message)

export function callbackPath(value: unknown, expectedOrigin: string): string {
  if (typeof value !== 'string' || value.length > 8192) throw fail(400, '请粘贴完整的本机回调地址。')
  let url: URL
  try { url = new URL(value.trim()) } catch { throw fail(400, '回调地址格式不正确。') }
  if (!value.trim().startsWith(`${expectedOrigin}/oauth/callback?`) || url.origin !== expectedOrigin || url.username || url.password || url.hash || url.pathname !== '/oauth/callback'
    || [...url.searchParams.keys()].some(key => !['code', 'state'].includes(key))
    || ['code', 'state'].some(key => url.searchParams.getAll(key).length !== 1 || !url.searchParams.get(key)?.trim())) {
    throw fail(400, '地址不属于本次登录。请复制授权后以指定本机地址开头、包含 code 和 state 的完整地址。')
  }
  // Never fetch the supplied URL. Only these parameters reach a fixed native route.
  return `/oauth/callback?${new URLSearchParams({ code: url.searchParams.get('code')!, state: url.searchParams.get('state')! })}`
}

export class AccountLoginBridge {
  private lease: Lease | undefined
  private tail: Promise<unknown> = Promise.resolve()
  private closed = false
  private request: AbortController | undefined
  constructor(private readonly account: AccountPort, private readonly upstream: () => string,
    private readonly clock: () => number = Date.now,
    private readonly deliver: typeof fetch = fetch) {}

  run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.catch(() => {}).then(() => {
      if (this.closed) throw fail(503, '登录适配已停止，请刷新页面。')
      return action()
    })
    this.tail = result
    return result
  }

  private async current(): Promise<AccountState> {
    let state = await this.account.getState()
    if (this.lease && this.lease.expiresAt <= this.clock() && state.attempt?.id === this.lease.id && active(state.attempt.phase)) {
      state = await this.account.cancelSignIn(this.lease.id)
    }
    return state
  }

  async status(owner: string): Promise<LoginView> {
    const state = await this.current()
    const lease = this.lease
    if (!lease || lease.owner !== digest(owner) || state.attempt?.id !== lease.id) {
      if (state.attempt && active(state.attempt.phase)) return { phase: 'busy', message: '已有其他窗口正在登录，请先完成或取消该登录。' }
      return { phase: state.status === 'credential-stored' ? 'signed-in' : 'idle' }
    }
    const attempt = state.attempt
    const phase = attempt.phase === 'succeeded' ? 'succeeded'
      : lease.expiresAt <= this.clock() ? 'expired' : attempt.phase
    return {
      phase, attemptId: lease.id, callbackOrigin: lease.origin,
      expiresAt: Math.min(lease.expiresAt, attempt.expiresAt ?? lease.expiresAt),
      ...(phase === 'waiting-browser' && attempt.authorizeUrl ? { authorizeUrl: this.authorizeUrl(attempt.authorizeUrl) } : {}),
      ...(phase === 'succeeded' ? {} : lease.error ? { message: lease.error } : phase === 'failed' ? { message: failureMessage(attempt.errorCode) } : {}),
    }
  }

  async start(owner: string, client: { version: string; locale: string; timezoneOffsetSeconds: number }): Promise<LoginView> {
    const state = await this.current()
    if (state.attempt && active(state.attempt.phase)) {
      if (this.lease?.id === state.attempt.id && this.lease.owner === digest(owner)) return this.status(owner)
      throw fail(409, '已有其他窗口正在登录，请先完成或取消该登录。')
    }
    if (state.status === 'credential-stored') return { phase: 'signed-in' }
    const upstream = new URL(this.upstream())
    const port = upstream.port || (upstream.protocol === 'https:' ? '443' : '80')
    const origin = `http://127.0.0.1:${port}`
    const started = await this.account.startSignIn(client, origin, 'web')
    if (!started.attempt) throw fail(502, '官方登录流程未建立，请稍后重试。')
    this.lease = { owner: digest(owner), id: started.attempt.id, origin, expiresAt: this.clock() + 600_000, submitted: false }
    return this.status(owner)
  }

  async submit(owner: string, id: unknown, address: unknown): Promise<LoginView> {
    const state = await this.current()
    const lease = this.owned(owner, id, state)
    if (lease.expiresAt <= this.clock()) throw fail(410, '登录已过期，请重新发起。')
    if (state.attempt?.phase !== 'waiting-browser' || lease.submitted) throw fail(409, '当前登录已提交或已结束，请刷新登录状态，不要重复提交。')
    const path = callbackPath(address, lease.origin)
    lease.submitted = true
    delete lease.error
    const controller = new AbortController()
    this.request = controller
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await this.deliver(new URL(path, this.upstream()), { redirect: 'manual', signal: controller.signal })
      await response.body?.cancel()
      if (response.status === 400) {
        lease.submitted = false
        throw fail(400, '回调校验失败，请检查是否复制了本次登录的完整地址。')
      }
      if (![200, 204, 302, 303].includes(response.status)) {
        lease.error = '回调未完成，请刷新登录状态；若失败请取消后重新发起。'
        throw fail(502, lease.error)
      }
    } catch (error) {
      if (error instanceof BridgeError) throw error
      // A timeout can occur after the native provider committed. Never replay codes.
      lease.error = '回调已提交，但未收到完成确认。请刷新状态；不要重复提交，失败后请重新发起。'
    } finally {
      clearTimeout(timer)
      this.request = undefined
    }
    return this.status(owner)
  }

  async cancel(owner: string, id: unknown): Promise<LoginView> {
    const state = await this.current()
    const lease = this.owned(owner, id, state)
    await this.account.cancelSignIn(lease.id)
    return this.status(owner)
  }

  async close(): Promise<void> {
    this.closed = true
    this.request?.abort()
    await this.tail.catch(() => {})
    if (this.lease) {
      const state = await this.account.getState()
      if (state.attempt?.id === this.lease.id && active(state.attempt.phase)) await this.account.cancelSignIn(this.lease.id)
    }
    this.lease = undefined
  }

  private owned(owner: string, id: unknown, state: AccountState): Lease {
    if (!this.lease || this.lease.owner !== digest(owner) || this.lease.id !== id || state.attempt?.id !== id) {
      throw fail(409, '登录不属于当前浏览器或服务已重启，请重新发起。')
    }
    return this.lease
  }
  private authorizeUrl(value: string): string {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.pathname !== '/dsh/authorize') {
      throw fail(502, '官方授权地址格式不受支持，请检查账号平台配置。')
    }
    return url.href
  }
}

function failureMessage(code?: string): string {
  if (code === 'expired') return '授权已过期，请重新发起登录。'
  if (code === 'no-response' || code === 'network') return '官方授权服务未正常响应，可能是网络异常或限流，请稍后重试。'
  if (code === 'storage') return 'DSH 未能保存账号凭据，请检查凭据存储。'
  return '官方授权未完成或响应格式不受支持，请稍后重新发起。'
}
