import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { AccessGateway } from '../lib/access/gateway.js'
import { resolveConfig } from '../lib/access/config.js'
import { PasswordStore } from '../lib/access/password.js'
import { SessionStore } from '../lib/access/sessions.js'
import { credentialSessionPersistence } from '../lib/access/session-persistence.js'
import { LoginLimiter, ProxyAssertion } from '../lib/access/security.js'

test('HTTP login persists before response; restart accepts cookie; logout rejects after restart', async () => {
  const records = new Map()
  const credentials = {
    async readRecord(key) { return structuredClone(records.get(String(key))) },
    async modifyRecord(key, update) { records.set(String(key), structuredClone(await update(await this.readRecord(key)))) },
  }
  const passwords = new PasswordStore(credentials)
  await passwords.set('gateway-test-password')
  const upstream = createServer((_req, res) => res.end('upstream'))
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
  const reservation = createServer()
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
  const port = reservation.address().port
  await new Promise(resolve => reservation.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const config = resolveConfig({ enabled: true, listenPort: port, secureCookies: false, publicOrigins: [base] })
  let gateway
  async function start() {
    const sessions = new SessionStore({ ttlMs: 60_000, idleMs: 30_000, bindToIp: false }, credentialSessionPersistence(credentials))
    await sessions.restore()
    gateway = new AccessGateway(config, upstream.address().port, passwords, sessions,
      new LoginLimiter(5, 60_000), new ProxyAssertion(), { authenticatedUrl: () => base }, { info() {}, warn() {} })
    await gateway.start()
  }
  try {
    await start()
    const login = await fetch(`${base}/__dsh_access/login`, {
      method: 'POST', headers: { origin: base, 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ password: 'gateway-test-password' }), redirect: 'manual',
    })
    assert.equal(login.status, 303)
    const cookie = login.headers.get('set-cookie').split(';')[0]
    await login.arrayBuffer()
    await gateway.close()
    await start()
    const status = await fetch(`${base}/__dsh_access/status`, { headers: { cookie } }).then(r => r.json())
    assert.deepEqual(status, { gateway: 'dsh-access-gate', authenticated: true })
    assert.equal(await fetch(base, { headers: { cookie } }).then(r => r.text()), 'upstream')
    const logout = await fetch(`${base}/__dsh_access/logout`, {
      method: 'POST', headers: { cookie, origin: base }, redirect: 'manual',
    })
    assert.equal(logout.status, 303)
    await logout.arrayBuffer()
    await gateway.close()
    await start()
    assert.equal((await fetch(`${base}/__dsh_access/status`, { headers: { cookie } }).then(r => r.json())).authenticated, false)
    assert.equal((await fetch(`${base}/api/test`, { headers: { cookie } })).status, 401)
  } finally {
    await gateway?.close()
    upstream.closeAllConnections()
    await new Promise(resolve => upstream.close(resolve))
  }
})
