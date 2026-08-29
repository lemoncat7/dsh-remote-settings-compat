import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import httpProxy from 'http-proxy'
import type { Config } from './config.js'
import { issueLoginCsrfToken, loginCsrfCookie, loginCsrfCookieName, verifyLoginCsrfToken } from './login-csrf.js'
import { loginPage } from './login-page.js'
import { PasswordStore } from './password.js'
import { LoginLimiter, ProxyAssertion, clientIp, isMachineBearerRequest, requestFetchSite, requestOriginAllowed, safePathname } from './security.js'
import { SessionStore, expiredSessionCookie, readCookie, sessionCookie, sessionCookieName, withoutCookie } from './sessions.js'

const AUTH_PREFIX = '/__dsh_access'
const MAX_LOGIN_BODY = 16 * 1024

export interface GatewayLogger {
  info(message: string): void
  warn(message: string): void
}

export interface GatewayStats {
  requestCount: number
  webSocketCount: number
  lastRequestAt?: number
}

export class AccessGateway {
  private readonly proxy = httpProxy.createProxyServer({ ws: true, xfwd: false, changeOrigin: false, ignorePath: false })
  private server: Server | undefined
  private requestCount = 0
  private webSocketCount = 0
  private lastRequestAt: number | undefined

  constructor(
    private readonly config: Config,
    private readonly upstreamPort: number,
    private readonly passwords: PasswordStore,
    private readonly sessions: SessionStore,
    private readonly limiter: LoginLimiter,
    private readonly assertion: ProxyAssertion,
    private readonly logger: GatewayLogger,
  ) {
    this.proxy.on('error', (error, _req, target) => {
      const response = target as ServerResponse
      if (typeof response.writeHead === 'function' && !response.headersSent) {
        response.writeHead(502, securityHeaders({ 'content-type': 'text/plain; charset=utf-8' }))
        response.end('DSH upstream is unavailable')
      } else if (typeof response.destroy === 'function') response.destroy(error)
      this.logger.warn(`dsh-access-gate: upstream proxy error: ${error.message}`)
    })
  }

  async start(): Promise<void> {
    if (this.server !== undefined) return
    const server = createServer((req, res) => { void this.handle(req, res).catch(error => this.fail(res, error)) })
    server.requestTimeout = 0
    server.headersTimeout = 15_000
    server.keepAliveTimeout = 5_000
    server.maxHeadersCount = 100
    server.on('clientError', (_error, socket) => {
      if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
      else socket.destroy()
    })
    server.on('upgrade', (req, socket, head) => {
      this.observe(true)
      const ip = clientIp(req, this.config)
      const authenticated = this.sessions.authenticate(readCookie(req.headers.cookie, this.cookieName), ip)
      const machine = isMachineBearerRequest(req, this.config)
      if ((!authenticated && !machine) || (authenticated && !requestOriginAllowed(req, this.config))) {
        socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        return
      }
      this.prepareUpstreamHeaders(req, authenticated)
      this.proxy.ws(req, socket, head, { target: this.target })
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.config.listenPort, this.config.listenHost, () => {
        server.off('error', reject)
        resolve()
      })
    })
    this.server = server
    this.logger.info(`dsh-access-gate: listening on http://${this.config.listenHost}:${this.config.listenPort}`)
  }

  async close(): Promise<void> {
    const server = this.server
    this.server = undefined
    if (server === undefined) return
    server.closeAllConnections?.()
    await new Promise<void>(resolve => server.close(() => resolve()))
    this.proxy.close()
  }

  get running(): boolean {
    return this.server !== undefined
  }

  get stats(): GatewayStats {
    return {
      requestCount: this.requestCount,
      webSocketCount: this.webSocketCount,
      ...(this.lastRequestAt === undefined ? {} : { lastRequestAt: this.lastRequestAt }),
    }
  }

  private get target(): string {
    return `http://127.0.0.1:${this.upstreamPort}`
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.observe(false)
    const pathname = safePathname(req.url)
    if (pathname === undefined) return this.text(res, 400, 'bad request')
    if (pathname === `${AUTH_PREFIX}/login` && req.method === 'GET') return this.showLogin(req, res)
    if (pathname === `${AUTH_PREFIX}/login` && req.method === 'POST') return this.login(req, res)
    if (pathname === `${AUTH_PREFIX}/logout` && req.method === 'POST') return this.logout(req, res)
    if (pathname === `${AUTH_PREFIX}/status` && req.method === 'GET') {
      const ip = clientIp(req, this.config)
      return this.json(res, 200, { authenticated: this.sessions.authenticate(readCookie(req.headers.cookie, this.cookieName), ip) })
    }
    if (pathname.startsWith(`${AUTH_PREFIX}/`)) return this.text(res, 404, 'not found')

    if (isMachineBearerRequest(req, this.config)) return this.forward(req, res, false)
    const ip = clientIp(req, this.config)
    if (this.sessions.authenticate(readCookie(req.headers.cookie, this.cookieName), ip)) return this.forward(req, res, true)
    if (pathname.startsWith('/api/') || pathname.endsWith('.json')) return this.json(res, 401, { error: 'authentication required' })
    const returnTo = safeReturnTo(req.url)
    res.writeHead(303, securityHeaders({ location: `${AUTH_PREFIX}/login?returnTo=${encodeURIComponent(returnTo)}` }))
    res.end()
  }

  private async showLogin(req: IncomingMessage, res: ServerResponse, error?: string, explicitReturnTo?: string): Promise<void> {
    const configured = await this.passwords.configured().catch(() => false)
    const url = new URL(req.url ?? '/', 'http://dsh.internal')
    const returnTo = explicitReturnTo ?? safeReturnTo(url.searchParams.get('returnTo') ?? '/')
    const csrfToken = issueLoginCsrfToken()
    const page = loginPage({ returnTo, csrfToken, configured, ...(error === undefined ? {} : { error }) })
    res.writeHead(configured ? 200 : 503, securityHeaders({
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': `default-src 'none'; style-src 'nonce-${page.nonce}'; script-src 'nonce-${page.nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
      'cache-control': 'no-store',
      'set-cookie': loginCsrfCookie(csrfToken, this.config.secureCookies),
    }))
    res.end(page.html)
  }

  private async login(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const form = new URLSearchParams((await readBody(req, MAX_LOGIN_BODY)).toString('utf8'))
    if (!this.loginRequestAllowed(req, form.get('csrfToken') ?? undefined)) return this.text(res, 403, 'forbidden')
    const ip = clientIp(req, this.config)
    const retry = this.limiter.retryAfter(ip)
    if (retry > 0) return this.text(res, 429, 'too many failed attempts', { 'retry-after': String(retry) })
    const password = form.get('password') ?? ''
    const returnTo = safeReturnTo(form.get('returnTo') ?? '/')
    if (!await this.passwords.configured()) return this.showLogin(req, res, '门禁密码尚未设置。', returnTo)
    let valid = false
    try { valid = await this.passwords.verify(password) } catch (error) {
      if (statusOf(error) === 429) return this.text(res, 429, 'server is busy', { 'retry-after': '2' })
      throw error
    }
    if (!valid) {
      const lockedFor = this.limiter.failure(ip)
      return this.showLogin(req, res, lockedFor > 0 ? '失败次数过多，请稍后再试。' : '密码不正确。', returnTo)
    }
    this.limiter.success(ip)
    const session = this.sessions.issue(ip)
    const maxAge = Math.max(1, Math.floor((session.expiresAt - Date.now()) / 1000))
    res.writeHead(303, securityHeaders({
      location: returnTo,
      'set-cookie': sessionCookie(session.token, maxAge, this.config.secureCookies),
      'cache-control': 'no-store',
    }))
    res.end()
  }

  private loginRequestAllowed(req: IncomingMessage, formToken: string | undefined): boolean {
    const fetchSite = requestFetchSite(req)
    if (fetchSite === 'cross-site') return false
    if (fetchSite === 'same-origin') return true
    if (req.headers.origin !== undefined) return requestOriginAllowed(req, this.config)
    const cookieToken = readCookie(req.headers.cookie, loginCsrfCookieName(this.config.secureCookies))
    const allowed = verifyLoginCsrfToken(formToken, cookieToken)
    if (!allowed) {
      this.logger.warn(`dsh-access-gate: login source rejected (fetch-site=${fetchSite ?? 'missing'}, origin=${req.headers.origin === undefined ? 'missing' : 'present'}, form-csrf=${formToken === undefined ? 'missing' : 'present'}, cookie-csrf=${cookieToken === undefined ? 'missing' : 'present'})`)
    }
    return allowed
  }

  private logout(req: IncomingMessage, res: ServerResponse): void {
    if (!requestOriginAllowed(req, this.config)) return this.text(res, 403, 'forbidden')
    this.sessions.invalidate(readCookie(req.headers.cookie, this.cookieName))
    res.writeHead(303, securityHeaders({
      location: `${AUTH_PREFIX}/login`,
      'set-cookie': expiredSessionCookie(this.config.secureCookies),
      'cache-control': 'no-store',
    }))
    res.end()
  }

  private forward(req: IncomingMessage, res: ServerResponse, authenticated: boolean): void {
    this.prepareUpstreamHeaders(req, authenticated)
    this.proxy.web(req, res, { target: this.target })
  }

  private prepareUpstreamHeaders(req: IncomingMessage, authenticated: boolean): void {
    delete req.headers['x-dsh-access-assertion']
    const cookie = withoutCookie(req.headers.cookie, this.cookieName)
    if (cookie === undefined) delete req.headers.cookie
    else req.headers.cookie = cookie
    if (authenticated) req.headers['x-dsh-access-assertion'] = this.assertion.issue()
  }

  private observe(webSocket: boolean): void {
    this.requestCount += 1
    if (webSocket) this.webSocketCount += 1
    this.lastRequestAt = Date.now()
  }

  private get cookieName(): string {
    return sessionCookieName(this.config.secureCookies)
  }

  private fail(res: ServerResponse, error: unknown): void {
    this.logger.warn(`dsh-access-gate: request failed: ${error instanceof Error ? error.message : String(error)}`)
    if (!res.headersSent) this.text(res, statusOf(error) ?? 500, statusOf(error) === 413 ? 'request too large' : 'request failed')
    else res.destroy(error instanceof Error ? error : undefined)
  }

  private text(res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}): void {
    res.writeHead(status, securityHeaders({ 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers }))
    res.end(body)
  }

  private json(res: ServerResponse, status: number, value: unknown): void {
    res.writeHead(status, securityHeaders({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }))
    res.end(JSON.stringify(value))
  }
}

function safeReturnTo(value: string | undefined): string {
  if (value === undefined) return '/'
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.startsWith(AUTH_PREFIX)) return '/'
  return value.length > 4096 ? '/' : value
}

function securityHeaders(extra: Record<string, string>): Record<string, string> {
  return {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    ...extra,
  }
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > limit) throw Object.assign(new Error('request body exceeds limit'), { status: 413 })
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

function statusOf(error: unknown): number | undefined {
  const status = error !== null && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
  return typeof status === 'number' && Number.isInteger(status) ? status : undefined
}
