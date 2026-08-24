import { randomBytes, timingSafeEqual } from 'node:crypto'

const SECURE_COOKIE = '__Host-dsh_access_csrf'
const INSECURE_COOKIE = 'dsh_access_csrf'
const TOKEN_BYTES = 32
const MAX_AGE_SECONDS = 10 * 60

export function issueLoginCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export function loginCsrfCookieName(secure: boolean): string {
  return secure ? SECURE_COOKIE : INSECURE_COOKIE
}

export function loginCsrfCookie(token: string, secure: boolean): string {
  return `${loginCsrfCookieName(secure)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`
}

export function verifyLoginCsrfToken(formToken: string | undefined, cookieToken: string | undefined): boolean {
  if (formToken === undefined || cookieToken === undefined) return false
  if (formToken.length !== 43 || cookieToken.length !== 43) return false
  const supplied = Buffer.from(formToken)
  const expected = Buffer.from(cookieToken)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
