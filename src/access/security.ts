import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Config } from './config.js'

interface FailureRecord {
  failures: number
  firstFailureAt: number
  lockedUntil: number
  lastSeenAt: number
}

export class LoginLimiter {
  private readonly records = new Map<string, FailureRecord>()

  constructor(private readonly maxAttempts: number, private readonly lockoutMs: number) {}

  retryAfter(ip: string, now = Date.now()): number {
    this.prune(now)
    const record = this.records.get(ip)
    return record === undefined || record.lockedUntil <= now ? 0 : Math.ceil((record.lockedUntil - now) / 1000)
  }

  failure(ip: string, now = Date.now()): number {
    let record = this.records.get(ip)
    if (record === undefined || now - record.firstFailureAt > this.lockoutMs) {
      record = { failures: 0, firstFailureAt: now, lockedUntil: 0, lastSeenAt: now }
    }
    record.failures += 1
    record.lastSeenAt = now
    if (record.failures >= this.maxAttempts) record.lockedUntil = now + this.lockoutMs
    this.records.set(ip, record)
    this.enforceBound()
    return this.retryAfter(ip, now)
  }

  success(ip: string): void {
    this.records.delete(ip)
  }

  private prune(now: number): void {
    for (const [ip, record] of this.records) {
      if (record.lockedUntil <= now && now - record.lastSeenAt > this.lockoutMs) this.records.delete(ip)
    }
  }

  private enforceBound(): void {
    while (this.records.size > 4096) {
      const oldest = this.records.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.records.delete(oldest)
    }
  }
}

export class ProxyAssertion {
  private readonly secret = randomBytes(32)

  issue(now = Date.now()): string {
    const timestamp = String(now)
    const nonce = randomBytes(12).toString('base64url')
    return `${timestamp}.${nonce}.${this.mac(`${timestamp}.${nonce}`)}`
  }

  verify(value: string | undefined, now = Date.now()): boolean {
    if (value === undefined) return false
    const parts = value.split('.')
    if (parts.length !== 3) return false
    const [timestamp, nonce, supplied] = parts
    if (timestamp === undefined || nonce === undefined || supplied === undefined || !/^\d{13}$/u.test(timestamp)) return false
    const issuedAt = Number(timestamp)
    if (!Number.isSafeInteger(issuedAt) || Math.abs(now - issuedAt) > 30_000) return false
    const expected = this.mac(`${timestamp}.${nonce}`)
    const actualBuffer = Buffer.from(supplied)
    const expectedBuffer = Buffer.from(expected)
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  }

  private mac(value: string): string {
    return createHmac('sha256', this.secret).update(value).digest('base64url')
  }
}

export function clientIp(req: IncomingMessage, config: Config): string {
  const remote = normalizeAddress(req.socket.remoteAddress ?? 'unknown')
  if (!config.trustedProxyAddresses.includes(remote)) return remote
  const forwarded = singleHeader(req.headers['x-real-ip'])
  return forwarded === undefined ? remote : normalizeAddress(forwarded)
}

export function requestOriginAllowed(req: IncomingMessage, config: Config): boolean {
  if (requestMarkedCrossSite(req)) return false
  const origin = singleHeader(req.headers.origin)
  if (origin === undefined) return false
  if (config.publicOrigins.length > 0) return config.publicOrigins.includes(origin)
  const host = singleHeader(req.headers.host)
  if (host === undefined || /[\s/\\]/u.test(host)) return false
  return origin === `${config.secureCookies ? 'https' : 'http'}://${host}`
}

export function requestMarkedCrossSite(req: IncomingMessage): boolean {
  return requestFetchSite(req) === 'cross-site'
}

export function requestFetchSite(req: IncomingMessage): string | undefined {
  return singleHeader(req.headers['sec-fetch-site'])
}

export function isMachineBearerRequest(req: IncomingMessage, config: Config): boolean {
  const pathname = safePathname(req.url)
  if (pathname === undefined || !config.machineBearerPrefixes.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))) return false
  const authorization = singleHeader(req.headers.authorization)
  if (authorization === undefined || !authorization.startsWith('Bearer ')) return false
  const token = authorization.slice(7)
  return token.length >= 24 && token.length <= 4096 && !/\s/u.test(token)
}

/** Allow only the public, immutable surface of a valid Knowledge share. */
export function isAnonymousKnowledgeShareRequest(req: IncomingMessage, config: Config): boolean {
  if (!config.allowAnonymousKnowledgeShares || req.method !== 'GET') return false
  const pathname = safePathname(req.url)
  if (pathname === undefined) return false
  return /^\/knowledge-api\/v1\/shared\/share_[A-Za-z0-9_-]{32}(?:\/(?:manifest|content))?\/?$/u.test(pathname)
}

export function safePathname(raw: string | undefined): string | undefined {
  try { return new URL(raw ?? '/', 'http://dsh.internal').pathname } catch { return undefined }
}

export function isLoopbackAddress(value: string | undefined): boolean {
  const normalized = normalizeAddress(value ?? '')
  return normalized === '127.0.0.1' || normalized === '::1'
}

function normalizeAddress(value: string): string {
  return value.startsWith('::ffff:') ? value.slice(7) : value
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
