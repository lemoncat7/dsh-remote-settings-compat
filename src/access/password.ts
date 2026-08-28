import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { credentialKey, type CredentialProvider, type GrantRecord } from '@deepseek-ai/dsh-credentials'

const PASSWORD_KEY = credentialKey('dsh-access-gate', 'password')
const SCRYPT_N = 32768
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_LENGTH = 32
const SCRYPT_MAXMEM = 64 * 1024 * 1024

interface PasswordVerifier {
  version: 1
  algorithm: 'scrypt'
  salt: string
  digest: string
  n: number
  r: number
  p: number
}

export class PasswordStore {
  private activeVerifications = 0

  constructor(private readonly credentials: CredentialProvider) {}

  async configured(): Promise<boolean> {
    return (await this.read()) !== undefined
  }

  async describe(): Promise<{ configured: boolean; writable: boolean }> {
    const info = await this.credentials.describeRecord(PASSWORD_KEY)
    return { configured: info.configured, writable: info.writable }
  }

  async set(password: string): Promise<void> {
    validatePassword(password)
    const salt = randomBytes(16)
    const digest = await derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    const verifier: PasswordVerifier = {
      version: 1,
      algorithm: 'scrypt',
      salt: salt.toString('base64url'),
      digest: digest.toString('base64url'),
      n: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    }
    await this.credentials.modifyRecord(PASSWORD_KEY, async () => ({ kind: 'grant', payload: verifier }))
  }

  async verify(password: string): Promise<boolean> {
    if (this.activeVerifications >= 4) throw Object.assign(new Error('password verification is busy'), { status: 429 })
    this.activeVerifications += 1
    try {
      const verifier = await this.read()
      if (verifier === undefined || password.length > 1024) return false
      const actual = await derive(password, Buffer.from(verifier.salt, 'base64url'), verifier.n, verifier.r, verifier.p)
      const expected = Buffer.from(verifier.digest, 'base64url')
      return expected.length === actual.length && timingSafeEqual(expected, actual)
    } finally {
      this.activeVerifications -= 1
    }
  }

  private async read(): Promise<PasswordVerifier | undefined> {
    const record = await this.credentials.readRecord(PASSWORD_KEY)
    if (record === undefined) return undefined
    if (record.kind !== 'grant') throw new Error('access gate password record has an unexpected credential kind')
    return decodeVerifier(record)
  }
}

export function validatePassword(password: string): void {
  if (password.length < 6) throw new Error('密码至少需要 6 个字符。')
  if (password.length > 1024) throw new Error('密码不能超过 1024 个字符。')
  if (/^[\s]+$/u.test(password)) throw new Error('密码不能只包含空白字符。')
}

function decodeVerifier(record: GrantRecord): PasswordVerifier {
  const value = record.payload
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('access gate password verifier is invalid')
  const item = value as Partial<PasswordVerifier>
  if (item.version !== 1 || item.algorithm !== 'scrypt'
    || typeof item.salt !== 'string' || typeof item.digest !== 'string'
    || item.n !== SCRYPT_N || item.r !== SCRYPT_R || item.p !== SCRYPT_P) {
    throw new Error('access gate password verifier is unsupported')
  }
  const salt = Buffer.from(item.salt, 'base64url')
  const digest = Buffer.from(item.digest, 'base64url')
  if (salt.length !== 16 || digest.length !== SCRYPT_LENGTH) throw new Error('access gate password verifier is malformed')
  return item as PasswordVerifier
}

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, SCRYPT_LENGTH, { N: n, r, p, maxmem: SCRYPT_MAXMEM }, (error, key) => {
      if (error !== null) reject(error)
      else resolve(key)
    })
  })
}

export function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('base64url')
}
