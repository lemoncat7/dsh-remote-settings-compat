import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { AccountLoginBridge, callbackPath } from '../lib/account-login/bridge.js'
import { accountLoginHandler, ACCOUNT_LOGIN_PREFIX } from '../lib/account-login/http.js'
import { ProxyAssertion } from '../lib/access/security.js'
import { resolveConfig } from '../lib/access/config.js'

const runtimeVersion = createRequire(import.meta.url)('@deepseek-ai/dsh-client-connection/package.json').version
const client = { version: runtimeVersion, locale: 'zh-CN', timezoneOffsetSeconds: 28800 }
const origin = 'http://127.0.0.1:3080'
const address = `${origin}/oauth/callback?code=one-time-code&state=expected-state`
function fixture(deliver) {
  let state = { status: 'signed-out', attempt: null }, now = Date.now(), starts = 0
  const cancels = [], requests = []
  const account = {
    async getState() { return structuredClone(state) },
    async startSignIn(metadata, callbackOrigin, source) {
      assert.deepEqual(metadata, client)
      assert.equal(callbackOrigin, origin)
      assert.equal(source, 'web')
      starts++
      state.attempt = { id: `attempt-${starts}`, phase: 'waiting-browser', authorizeUrl: 'https://platform.deepseek.com/dsh/authorize?id=opaque', expiresAt: now + 600000 }
      return this.getState()
    },
    async cancelSignIn(id) { cancels.push(id); if (state.attempt?.id === id) state.attempt.phase = 'cancelled'; return this.getState() },
  }
  const bridge = new AccountLoginBridge(account, () => 'http://192.0.2.10:3080', () => now, async (url, options) => {
    requests.push({url: String(url), options})
    if (deliver) return deliver(state, url, options)
    if (new URL(url).searchParams.get('state') !== 'expected-state') return new Response(null, { status: 400 })
    state.status = 'credential-stored'; state.attempt.phase = 'succeeded'
    return new Response(null, { status: 302, headers: { location: 'https://platform.deepseek.com/dsh/authorized' } })
  })
  return { bridge, account, requests, cancels, starts: () => starts, state: () => state, setState: value => { state = value }, advance: ms => { now += ms } }
}

test('manual callback is delivered only to native server, never follows redirects, and succeeds only from native state', async () => {
  const f = fixture()
  const start = await f.bridge.run(() => f.bridge.start('owner', client))
  assert.equal(start.callbackOrigin, origin)
  assert.equal((await f.bridge.run(() => f.bridge.submit('owner', start.attemptId, address))).phase, 'succeeded')
  assert.equal(f.requests[0].url, 'http://192.0.2.10:3080/oauth/callback?code=one-time-code&state=expected-state')
  assert.equal(f.requests[0].options.redirect, 'manual')
  assert.equal(f.requests[0].options.headers, undefined)
  await assert.rejects(f.bridge.submit('owner', start.attemptId, address), /不要重复提交/)
  assert.equal(f.requests.length, 1)
  await f.bridge.close()
  assert.deepEqual(f.cancels, [])
})

test('rejects foreign origins, paths, credentials, duplicate fields, fragments and oversized input', () => {
  for (const value of [undefined, '', 'x'.repeat(8193), address.replace('127.0.0.1', 'evil.example'),
    address.replace(':3080', ':3081'), address.replace('http:', 'https:'), address.replace('/oauth/callback', '/api/settings'),
    address.replace('127.0.0.1', 'user:pass@127.0.0.1'), `${address}#fragment`, `${address}&state=other`, `${address}&redirect_uri=http://evil`,
    address.replace('one-time-code', ''), address.replace('&state=expected-state', ''), address.replace('one-time-code', '%20'),
    'http://2130706433:3080/oauth/callback?code=x&state=y.evil']) {
    assert.throws(() => callbackPath(value, origin), { status: 400 })
  }
  assert.equal(callbackPath(`  ${address}  `, origin), '/oauth/callback?code=one-time-code&state=expected-state')
})

test('other browser cannot view authorization URL, submit or cancel the owner attempt', async () => {
  const f = fixture()
  const start = await f.bridge.start('a', client)
  assert.deepEqual(await f.bridge.status('b'), {phase:'busy', message:'已有其他窗口正在登录，请先完成或取消该登录。'})
  await assert.rejects(f.bridge.start('b', client), {status:409})
  await assert.rejects(f.bridge.submit('b', start.attemptId, address), {status:409})
  await assert.rejects(f.bridge.cancel('b', start.attemptId), {status:409})
  assert.deepEqual(f.requests, [])
  assert.deepEqual(f.cancels, [])
  await f.bridge.close()
})

test('same browser can resume; concurrent starts and duplicate submits do not duplicate native work', async () => {
  const f = fixture()
  const states = await Promise.all(Array.from({length:5},()=>f.bridge.run(()=>f.bridge.start('a',client))))
  assert.equal(f.starts(),1)
  assert.ok(states.every(s=>s.attemptId===states[0].attemptId))
  const settled = await Promise.allSettled(Array.from({length:2},()=>f.bridge.run(()=>f.bridge.submit('a',states[0].attemptId,address))))
  assert.equal(settled.filter(s=>s.status==='fulfilled').length,1)
  assert.equal(f.requests.length,1)
  await f.bridge.close()
})

test('expired or stale attempts cannot be delivered and clear cancellation permits retry', async () => {
  const f = fixture()
  const start = await f.bridge.start('a',client)
  f.advance(600001)
  assert.equal((await f.bridge.status('a')).phase,'expired')
  await assert.rejects(f.bridge.submit('a',start.attemptId,address),{status:410})
  const next = await f.bridge.start('a',client)
  await assert.rejects(f.bridge.submit('a',start.attemptId,address),{status:409})
  assert.notEqual(next.attemptId,start.attemptId)
  await f.bridge.close()
  await assert.rejects(f.bridge.run(()=>f.bridge.status('a')),{status:503})
})

test('native callback state validation failure allows corrected paste without issuing another login', async () => {
  const f = fixture()
  const start = await f.bridge.start('a',client)
  await assert.rejects(f.bridge.submit('a',start.attemptId,address.replace('expected-state','wrong')),{status:400})
  assert.equal((await f.bridge.submit('a',start.attemptId,address)).phase,'succeeded')
  assert.equal(f.starts(),1)
  await f.bridge.close()
})

test('native failure page is not success and errors are classified without secret details', async () => {
  const f = fixture(state => { state.attempt.phase='failed'; state.attempt.errorCode='network'; return new Response('private body',{status:200}) })
  const start = await f.bridge.start('a',client)
  const result = await f.bridge.submit('a',start.attemptId,address)
  assert.equal(result.phase,'failed')
  assert.match(result.message,/限流/)
  assert.doesNotMatch(JSON.stringify(result),/private body|one-time-code/)
  await f.bridge.close()
})

test('ambiguous transport failure does not replay authorization code; successful native commit wins', async () => {
  const f = fixture(state => { state.status='credential-stored'; state.attempt.phase='succeeded'; throw new Error('private token') })
  const start = await f.bridge.start('a',client)
  const result = await f.bridge.submit('a',start.attemptId,address)
  assert.equal(result.phase,'succeeded')
  assert.equal(result.message,undefined)
  assert.doesNotMatch(JSON.stringify(result),/private token/)
  await assert.rejects(f.bridge.submit('a',start.attemptId,address),{status:409})
  await f.bridge.close()
})

test('restart or native competing attempt is never adopted or cancelled', async () => {
  const f = fixture()
  f.setState({status:'signed-out',attempt:{id:'native',phase:'waiting-browser',authorizeUrl:'https://secret.example'}})
  await assert.rejects(f.bridge.start('a',client),{status:409})
  await f.bridge.close()
  assert.deepEqual(f.cancels,[])
})

test('stored account is left intact and is not replaced by auxiliary login', async () => {
  const f = fixture()
  f.setState({status:'credential-stored',attempt:null})
  assert.deepEqual(await f.bridge.start('a',client),{phase:'signed-in'})
  assert.equal(f.starts(),0)
  await f.bridge.close()
})

test('HTTP enforces signed gateway, exact Origin, mutation header, JSON and browser cookie ownership', async t => {
  const f = fixture()
  const config = resolveConfig({secureCookies:true,publicOrigins:['https://dsh.example.test']})
  const assertion = new ProxyAssertion()
  const server = createServer(accountLoginHandler(f.bridge,config,assertion))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.bridge.close()})
  const url = `http://127.0.0.1:${server.address().port}${ACCOUNT_LOGIN_PREFIX}`
  const headers = () => ({origin:config.publicOrigins[0],'content-type':'application/json','x-dsh-account-action':'1','x-dsh-access-assertion':assertion.issue()})
  const request = (action,body={},extra={},method='POST')=>fetch(url+'/'+action,{method,headers:{...headers(),...extra},...(method==='POST'?{body:JSON.stringify(body)}:{})})
  for (const extra of [{'x-dsh-access-assertion':'invalid'}, {origin:'https://evil.test'}, {'x-dsh-account-action':''}, {'sec-fetch-site':'cross-site'}, {'content-type':'text/plain'}]) {
    assert.equal((await request('start',client,extra)).status,403)
  }
  assert.equal((await request('start',{}, {},'GET')).status,405)
  assert.equal((await request('unknown')).status,404)
  assert.equal((await request('start',{locale:'zh-CN',timezoneOffsetSeconds:'bad'})).status,400)
  assert.equal((await request('callback',{address})).status,409)
  assert.equal((await request('start',{big:'x'.repeat(13000)})).status,413)
  // Browser-supplied versions must not override the actual host version.
  const started = await request('start',{...client,version:'untrusted-browser-version'})
  assert.equal(started.status,200)
  assert.match(started.headers.get('set-cookie'),/^__Host-dsh_account_bridge=.*; Path=\/; HttpOnly; SameSite=Strict; Secure$/)
  const cookie = started.headers.get('set-cookie').split(';')[0]
  const result = await started.json()
  const other = await request('status')
  assert.equal((await other.json()).authorizeUrl,undefined)
  const callback = await request('callback',{attemptId:result.attemptId,address},{cookie})
  assert.equal(callback.headers.get('cache-control'),'no-store')
  assert.equal((await callback.json()).phase,'succeeded')
})

test('untrusted native exceptions never reach the HTTP response', async t => {
  const assertion = new ProxyAssertion(), config=resolveConfig({publicOrigins:['https://dsh.test']})
  const bridge = new AccountLoginBridge({getState:async()=>{throw Object.assign(new Error('token=private'),{status:400})}},()=>origin)
  const server=createServer(accountLoginHandler(bridge,config,assertion))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await bridge.close()})
  const response=await fetch(`http://127.0.0.1:${server.address().port}${ACCOUNT_LOGIN_PREFIX}/status`,{method:'POST',headers:{origin:'https://dsh.test','content-type':'application/json','x-dsh-account-action':'1','x-dsh-access-assertion':assertion.issue()},body:'{}'})
  assert.equal(response.status,503)
  assert.doesNotMatch(await response.text(),/private/)
})
