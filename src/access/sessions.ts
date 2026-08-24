import { randomBytes } from 'node:crypto'
import { tokenDigest } from './password.js'

const SECURE_SESSION_COOKIE = '__Host-dsh_access'
const INSECURE_SESSION_COOKIE = 'dsh_access'

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE : INSECURE_SESSION_COOKIE
}

interface SessionRecord {
  digest: string
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  ip?: string
}

export interface SessionPolicy {
  ttlMs: number
  idleMs: number
  bindToIp: boolean
}

export class SessionStore {
  private readonly sessions = new Map<string, SessionRecord>()

  constructor(private readonly policy: SessionPolicy) {}

  issue(ip: string, now = Date.now()): { token: string; expiresAt: number } {
    this.prune(now)
    while (this.sessions.size >= 64) {
      const oldest = this.sessions.keys().next().value as string | undefined
      if (oldest === undefined) break
      this.sessions.delete(oldest)
    }
    const token = randomBytes(32).toString('base64url')
    const digest = tokenDigest(token)
    const expiresAt = now + this.policy.ttlMs
    this.sessions.set(digest, {
      digest,
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      ...(this.policy.bindToIp ? { ip } : {}),
    })
    return { token, expiresAt }
  }

  authenticate(token: string | undefined, ip: string, now = Date.now()): boolean {
    if (token === undefined || token.length < 32 || token.length > 256) return false
    const digest = tokenDigest(token)
    const record = this.sessions.get(digest)
    if (record === undefined) return false
    if (record.expiresAt <= now || now - record.lastSeenAt > this.policy.idleMs || (record.ip !== undefined && record.ip !== ip)) {
      this.sessions.delete(digest)
      return false
    }
    record.lastSeenAt = now
    this.sessions.delete(digest)
    this.sessions.set(digest, record)
    return true
  }

  invalidate(token: string | undefined): void {
    if (token !== undefined) this.sessions.delete(tokenDigest(token))
  }

  invalidateAll(): void {
    this.sessions.clear()
  }

  count(now = Date.now()): number {
    this.prune(now)
    return this.sessions.size
  }

  private prune(now: number): void {
    for (const [digest, record] of this.sessions) {
      if (record.expiresAt <= now || now - record.lastSeenAt > this.policy.idleMs) this.sessions.delete(digest)
    }
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 1) continue
    if (part.slice(0, index).trim() !== name) continue
    const value = part.slice(index + 1).trim()
    try { return decodeURIComponent(value) } catch { return undefined }
  }
  return undefined
}

export function withoutCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined
  const kept = header.split(';').filter(part => part.slice(0, part.indexOf('=')).trim() !== name)
  return kept.length === 0 ? undefined : kept.join(';')
}

export function sessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  return `${sessionCookieName(secure)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`
}

export function expiredSessionCookie(secure: boolean): string {
  return `${sessionCookieName(secure)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`
}
