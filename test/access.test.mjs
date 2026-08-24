import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig } from '../lib/access/config.js'
import { PasswordStore, validatePassword } from '../lib/access/password.js'
import { issueLoginCsrfToken, loginCsrfCookie, loginCsrfCookieName, verifyLoginCsrfToken } from '../lib/access/login-csrf.js'
import { isMachineBearerRequest, requestFetchSite } from '../lib/access/security.js'
import { SessionStore, expiredSessionCookie, sessionCookie, sessionCookieName } from '../lib/access/sessions.js'

class MemoryCredentials {
  records = new Map()

  async readRecord(key) {
    return this.records.get(String(key))
  }

  async modifyRecord(key, update) {
    const id = String(key)
    const next = await update(this.records.get(id))
    if (next === undefined) this.records.delete(id)
    else this.records.set(id, next)
  }
}

test('password verifier never stores the plaintext password', async () => {
  const credentials = new MemoryCredentials()
  const store = new PasswordStore(credentials)
  const password = 'a secure test password 123'
  await store.set(password)
  const serialized = JSON.stringify([...credentials.records.values()])
  assert.equal(serialized.includes(password), false)
  assert.equal(await store.verify(password), true)
  assert.equal(await store.verify(`${password}!`), false)
})

test('password policy accepts six characters and rejects five', () => {
  assert.doesNotThrow(() => validatePassword('abc123'))
  assert.throws(() => validatePassword('abc12'), /6/u)
})

test('session expiration, idle timeout and IP binding are enforced', () => {
  const sessions = new SessionStore({ ttlMs: 10_000, idleMs: 1_000, bindToIp: true })
  const issued = sessions.issue('192.0.2.10', 1_000)
  assert.equal(sessions.authenticate(issued.token, '192.0.2.10', 1_500), true)
  assert.equal(sessions.authenticate(issued.token, '192.0.2.11', 1_600), false)

  const second = sessions.issue('192.0.2.10', 2_000)
  assert.equal(sessions.authenticate(second.token, '192.0.2.10', 3_001), false)
})

test('secure and HTTP cookie names follow browser prefix rules', () => {
  assert.equal(sessionCookieName(true), '__Host-dsh_access')
  assert.equal(sessionCookieName(false), 'dsh_access')
  assert.match(sessionCookie('token', 60, true), /^__Host-dsh_access=.*; Secure$/u)
  assert.match(sessionCookie('token', 60, false), /^dsh_access=/u)
  assert.doesNotMatch(sessionCookie('token', 60, false), /; Secure/u)
  assert.match(expiredSessionCookie(true), /Max-Age=0; Secure$/u)
})

test('login CSRF tokens support same-origin form posts without an Origin header', () => {
  const token = issueLoginCsrfToken()
  assert.equal(token.length, 43)
  assert.equal(loginCsrfCookieName(true), '__Host-dsh_access_csrf')
  assert.match(loginCsrfCookie(token, true), /^__Host-dsh_access_csrf=.*; HttpOnly; SameSite=Strict; Max-Age=600; Secure$/u)
  assert.equal(verifyLoginCsrfToken(token, token), true)
  assert.equal(verifyLoginCsrfToken(token, issueLoginCsrfToken()), false)
  assert.equal(verifyLoginCsrfToken(undefined, token), false)
})

test('fetch metadata can distinguish browser same-origin and cross-site form posts', () => {
  assert.equal(requestFetchSite({ headers: { 'sec-fetch-site': 'same-origin' } }), 'same-origin')
  assert.equal(requestFetchSite({ headers: { 'sec-fetch-site': 'cross-site' } }), 'cross-site')
  assert.equal(requestFetchSite({ headers: {} }), undefined)
})

test('only configured machine API prefixes accept bearer bypass', () => {
  const config = resolveConfig({ machineBearerPrefixes: ['/knowledge-api/v1'] })
  const request = path => ({
    url: path,
    headers: { authorization: `Bearer ${'x'.repeat(32)}` },
  })
  assert.equal(isMachineBearerRequest(request('/knowledge-api/v1/search'), config), true)
  assert.equal(isMachineBearerRequest(request('/knowledge-api/v10/search'), config), false)
  assert.equal(isMachineBearerRequest(request('/api/settings.describe'), config), false)
})

test('unsafe broad machine prefixes are rejected', () => {
  assert.throws(() => resolveConfig({ machineBearerPrefixes: ['/api'] }), /too broad/u)
  assert.throws(() => resolveConfig({ listenHost: '0.0.0.0', publicOrigins: [] }), /publicOrigins/u)
})
