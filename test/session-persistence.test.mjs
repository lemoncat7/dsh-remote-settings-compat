import test from 'node:test'
import assert from 'node:assert/strict'
import { SessionStore } from '../lib/access/sessions.js'
import { credentialSessionPersistence } from '../lib/access/session-persistence.js'
import { PasswordStore } from '../lib/access/password.js'
import { isExpiredGateResponse } from '../lib/access/auth-recovery.js'

class Credentials {
  records = new Map()
  fail = false
  async readRecord(key) { return structuredClone(this.records.get(String(key))) }
  async modifyRecord(key, update) {
    if (this.fail) throw new Error('disk unavailable')
    this.records.set(String(key), structuredClone(await update(await this.readRecord(key))))
  }
}
const policy = { ttlMs: 10_000, idleMs: 1_000, bindToIp: false }
async function create(credentials, now = 1_000, overrides = {}) {
  const store = new SessionStore({ ...policy, ...overrides }, credentialSessionPersistence(credentials))
  await store.restore(now)
  return store
}
async function setup() {
  const credentials = new Credentials()
  const passwords = new PasswordStore(credentials)
  await passwords.set('test-password')
  return { credentials, passwords }
}

test('sessions survive restart without persisting bearer token; logout survives restart', async () => {
  const { credentials } = await setup()
  const first = await create(credentials)
  const issued = first.issue('ip', 1_000)
  await first.flush()
  assert.equal(JSON.stringify([...credentials.records]).includes(issued.token), false)
  const second = await create(credentials, 1_500)
  assert.equal(second.authenticate(issued.token, 'ip', 1_600), true)
  second.invalidate(issued.token)
  await second.flush()
  assert.equal((await create(credentials, 1_700)).authenticate(issued.token, 'ip', 1_700), false)
})

test('password changes invalidate persisted sessions even if process stops before revocation', async () => {
  const { credentials, passwords } = await setup()
  const first = await create(credentials)
  const issued = first.issue('ip', 1_000)
  await first.flush()
  await passwords.set('changed-password')
  first.authenticate(issued.token, 'ip', 1_100)
  await assert.rejects(first.flush(), /generation/)
  assert.equal((await create(credentials, 1_200)).authenticate(issued.token, 'ip', 1_200), false)
  first.invalidateAll()
  await first.flush()
  const fresh = first.issue('ip', 1_300)
  await first.flush()
  assert.equal((await create(credentials, 1_400)).authenticate(fresh.token, 'ip', 1_400), true)
})

test('expiry, idle, stricter policy and IP binding survive restart', async () => {
  const { credentials } = await setup()
  const first = await create(credentials)
  const issued = first.issue('ip', 1_000)
  await first.flush()
  assert.equal((await create(credentials, 2_001)).authenticate(issued.token, 'ip', 2_001), false)
  assert.equal((await create(credentials, 1_600, { ttlMs: 500 })).authenticate(issued.token, 'ip', 1_600), false)
  assert.equal((await create(credentials, 1_100, { bindToIp: true })).authenticate(issued.token, 'ip', 1_100), false)
  const bound = await create(credentials, 1_100, { bindToIp: true })
  const token = bound.issue('ip', 1_100).token
  await bound.flush()
  assert.equal((await create(credentials, 1_200, { bindToIp: true })).authenticate(token, 'other', 1_200), false)
})

test('status probes do not extend idle timeout; failed persistence is retryable', async () => {
  const { credentials } = await setup()
  const store = await create(credentials)
  const { token } = store.issue('ip', 1_000)
  credentials.fail = true
  await assert.rejects(store.flush(), /disk/)
  credentials.fail = false
  await store.flush()
  assert.equal(store.authenticate(token, 'ip', 1_900, false), true)
  assert.equal(store.authenticate(token, 'ip', 2_001, false), false)
  await store.flush()
  assert.equal((await create(credentials, 2_100)).count(2_100), 0)
})

test('revocation and maximum session count are persisted', async () => {
  const { credentials } = await setup()
  const store = await create(credentials)
  const oldest = store.issue('ip', 1_000).token
  for (let i = 0; i < 65; i++) store.issue('ip', 1_000)
  await store.flush()
  const restored = await create(credentials, 1_100)
  assert.equal(restored.count(1_100), 64)
  assert.equal(restored.authenticate(oldest, 'ip', 1_100), false)
  restored.invalidateAll()
  await restored.flush()
  assert.equal((await create(credentials, 1_200)).count(1_200), 0)
})

test('only explicit access-gate expiry can trigger login recovery', () => {
  for (const value of [null, {}, { authenticated: false }, { gateway: 'dsh-access-gate', authenticated: true }]) {
    assert.equal(isExpiredGateResponse(value), false)
  }
  assert.equal(isExpiredGateResponse({ gateway: 'dsh-access-gate', authenticated: false }), true)
})
