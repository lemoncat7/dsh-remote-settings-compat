import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config } from './config.js'
import type { AccessGateway } from './gateway.js'
import { PasswordStore, validatePassword } from './password.js'
import { ProxyAssertion, isLoopbackAddress } from './security.js'
import type { SessionStore } from './sessions.js'

export const ADMIN_PREFIX = '/access-gate-admin/v1'
const MAX_BODY_BYTES = 16 * 1024

interface WebServerLike {
  host: string
  port: number
  register(route: {
    kind: 'prefix'
    path: string
    handler(req: IncomingMessage, res: ServerResponse): void | Promise<void>
  }): () => void
}

export interface AdminRuntime {
  config: Config
  webServer: WebServerLike
  passwords: PasswordStore
  sessions: SessionStore
  assertion: ProxyAssertion
  gateway: AccessGateway
  setupToken: string
  trustedOrigins: readonly string[]
  originSource(): 'trustedOrigins' | 'legacy-publicOrigins' | 'none'
}

export function registerAdminApi(runtime: AdminRuntime): () => void {
  return runtime.webServer.register({
    kind: 'prefix',
    path: ADMIN_PREFIX,
    handler: async (req, res) => {
      try { await dispatch(runtime, req, res) } catch (error) { sendError(res, error) }
    },
  })
}

async function dispatch(runtime: AdminRuntime, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://dsh.internal')
  const relative = url.pathname.slice(ADMIN_PREFIX.length).replace(/^\/+|\/+$/gu, '')
  if (req.method === 'GET' && relative === 'status') {
    const credential = await runtime.passwords.describe()
    const viaGateway = runtime.assertion.verify(header(req, 'x-dsh-access-assertion'))
    return sendJson(res, 200, {
      configured: credential.configured,
      credentialStoreWritable: credential.writable,
      gatewayEnabled: runtime.config.enabled,
      gatewayRunning: runtime.gateway.running,
      listenHost: runtime.config.listenHost,
      listenPort: runtime.config.listenPort,
      upstreamHost: runtime.webServer.host,
      upstreamPort: runtime.webServer.port,
      activeSessions: runtime.sessions.count(),
      trustedOriginCount: runtime.trustedOrigins.length,
      originSource: runtime.originSource(),
      viaGateway,
      entry: viaGateway ? 'access-gate' : 'raw-upstream',
      gatewayStats: runtime.gateway.stats,
      rawUpstreamExposurePossible: !isLoopbackHost(runtime.webServer.host),
    })
  }
  if (req.method === 'PUT' && relative === 'password') {
    requireMutation(req)
    const body = await readObject(req)
    const password = requiredString(body.password, 'password')
    validatePassword(password)
    const configured = await runtime.passwords.configured()
    if (configured) {
      requireTrustedAdmin(runtime, req)
      const currentPassword = requiredString(body.currentPassword, 'currentPassword')
      if (!await runtime.passwords.verify(currentPassword)) throw httpError(403, '当前密码不正确。')
    } else {
      const setupToken = requiredString(body.setupToken, 'setupToken')
      if (!safeEqual(setupToken, runtime.setupToken)) throw httpError(403, '初始化令牌不正确。')
    }
    await runtime.passwords.set(password)
    runtime.sessions.invalidateAll()
    await runtime.sessions.flush()
    return sendJson(res, 200, { ok: true, sessionsRevoked: true })
  }
  if (req.method === 'POST' && relative === 'sessions/revoke') {
    requireMutation(req)
    requireTrustedAdmin(runtime, req)
    runtime.sessions.invalidateAll()
    await runtime.sessions.flush()
    return sendJson(res, 200, { ok: true })
  }
  sendJson(res, 404, { error: 'not found' })
}

function isLoopbackHost(value: string): boolean {
  return value === '127.0.0.1' || value === '::1' || value === 'localhost'
}

function requireTrustedAdmin(runtime: AdminRuntime, req: IncomingMessage): void {
  const asserted = runtime.assertion.verify(header(req, 'x-dsh-access-assertion'))
  if (asserted) return
  if (isLoopbackAddress(req.socket.remoteAddress)) return
  throw httpError(403, '请通过已登录的认证网关或 DSH 本机修改门禁。')
}

function requireMutation(req: IncomingMessage): void {
  if (header(req, 'x-dsh-access-action') !== '1') throw httpError(403, 'missing mutation header')
  if (header(req, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') throw httpError(415, 'content type must be application/json')
}

async function readObject(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw httpError(413, 'request body is too large')
    chunks.push(buffer)
  }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw httpError(400, 'body must be JSON') }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw httpError(400, 'body must be an object')
  return value as Record<string, unknown>
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string') throw httpError(400, `${name} must be a string`)
  return value
}

function safeEqual(actual: string, expected: string): boolean {
  const left = Buffer.from(actual)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}

function sendError(res: ServerResponse, error: unknown): void {
  const status = error !== null && typeof error === 'object' && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : 500
  sendJson(res, status, { error: status >= 500 ? '门禁管理操作失败。' : error instanceof Error ? error.message : String(error) })
}

function httpError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status })
}

export function createSetupToken(): string {
  return randomBytes(24).toString('base64url')
}
