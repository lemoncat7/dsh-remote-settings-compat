import { randomBytes } from 'node:crypto'
import { tokenDigest } from './password.js'

const SECURE_SESSION_COOKIE = '__Host-dsh_access'
const INSECURE_SESSION_COOKIE = 'dsh_access'

export function sessionCookieName(secure: boolean): string {
  return secure ? SECURE_SESSION_COOKIE : INSECURE_SESSION_COOKIE
}

export interface SessionRecord {
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
  private revision = 0
  private savedRevision = 0
  private writing: Promise<void> = Promise.resolve()

  constructor(private readonly policy: SessionPolicy, private readonly persistence?: {
    load(): Promise<unknown>
    save(records: SessionRecord[]): Promise<void>
  }) {}

  async restore(now = Date.now()): Promise<void> {
    if (!this.persistence) return
    const records = await this.persistence.load()
    this.sessions.clear()
    if (Array.isArray(records) && records.length <= 64) {
      for (const record of records) {
        if (!record || typeof record.digest !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(record.digest)
          || !Number.isSafeInteger(record.createdAt) || !Number.isSafeInteger(record.lastSeenAt)
          || !Number.isSafeInteger(record.expiresAt) || record.createdAt > record.lastSeenAt
          || record.lastSeenAt > now || record.expiresAt <= record.createdAt
          || (record.ip !== undefined && typeof record.ip !== 'string')
          || (this.policy.bindToIp && typeof record.ip !== 'string')) continue
        this.sessions.set(record.digest, { ...record, expiresAt: Math.min(record.expiresAt, record.createdAt + this.policy.ttlMs) })
      }
    }
    this.prune(now)
  }

  /** Serialize snapshots; failed writes remain dirty and can be retried. */
  flush(): Promise<void> {
    const next = this.writing.catch(() => {}).then(async () => {
      if (!this.persistence || this.savedRevision === this.revision) return
      const revision = this.revision
      await this.persistence.save([...this.sessions.values()].map(record => ({ ...record })))
      this.savedRevision = revision
    })
    this.writing = next
    return next
  }

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
    this.revision++
    return { token, expiresAt }
  }

  authenticate(token: string | undefined, ip: string, now = Date.now(), touch = true): boolean {
    if (token === undefined || token.length < 32 || token.length > 256) return false
    const digest = tokenDigest(token)
    const record = this.sessions.get(digest)
    if (record === undefined) return false
    if (record.expiresAt <= now || now - record.lastSeenAt > this.policy.idleMs || (record.ip !== undefined && record.ip !== ip)) {
      this.sessions.delete(digest)
      this.revision++
      return false
    }
    if (!touch) return true
    record.lastSeenAt = now
    this.revision++
    this.sessions.delete(digest)
    this.sessions.set(digest, record)
    return true
  }

  invalidate(token: string | undefined): void {
    if (token !== undefined && this.sessions.delete(tokenDigest(token))) this.revision++
  }

  invalidateAll(): void {
    this.sessions.clear()
    this.revision++
  }

  count(now = Date.now()): number {
    this.prune(now)
    return this.sessions.size
  }

  private prune(now: number): void {
    for (const [digest, record] of this.sessions) {
      if (record.expiresAt <= now || now - record.lastSeenAt > this.policy.idleMs) {
        this.sessions.delete(digest)
        this.revision++
      }
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
