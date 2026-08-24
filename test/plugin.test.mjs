import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  injectTrustedOriginsMeta,
} from '../lib/index.js'
import {
  overrideLoopbackClassification,
  readTrustedOrigins,
} from '../lib/client-core.js'
import {
  decodeRemoteSettingsValue,
  parseTrustedOriginsText,
} from '../lib/client-settings.js'
import {
  isTrustedOrigin,
  normalizeTrustedOrigins,
  trustedAuthorities,
  TRUSTED_ORIGINS_META_NAME,
} from '../lib/shared.js'

test('trusted origins are exact, canonical and wildcard-free', () => {
  assert.deepEqual(normalizeTrustedOrigins([
    ' https://dsh.example.com:1443 ',
    'https://dsh.example.com:1443/',
  ]), ['https://dsh.example.com:1443'])
  assert.equal(isTrustedOrigin('https://dsh.example.com:1443', ['https://dsh.example.com:1443']), true)
  assert.equal(isTrustedOrigin('https://evil.example.com:1443', ['https://dsh.example.com:1443']), false)
  assert.throws(() => normalizeTrustedOrigins(['https://*.example.com']), /wildcard/)
  assert.throws(() => normalizeTrustedOrigins(['https://dsh.example.com/settings']), /path/)
  assert.deepEqual(trustedAuthorities([
    'https://dsh.example.com:1443',
    'https://dsh.example.com:1443/',
    'https://admin.example.com',
  ]), ['dsh.example.com:1443', 'admin.example.com'])
})

test('host publishes inert escaped metadata and the client reads it', () => {
  const html = injectTrustedOriginsMeta('<html><head></head><body></body></html>', [
    'https://dsh.example.com:1443',
  ])
  assert.match(html, new RegExp(`<meta name="${TRUSTED_ORIGINS_META_NAME}"`))
  assert.match(html, /&quot;https:\/\/dsh\.example\.com:1443&quot;/)
  assert.doesNotMatch(html, /<script/)

  const origins = readTrustedOrigins({
    querySelector: () => ({ content: '["https://dsh.example.com:1443"]' }),
  })
  assert.deepEqual(origins, ['https://dsh.example.com:1443'])
})

test('loopback compatibility override is reversible', () => {
  const connection = { isLoopback: false }
  const restore = overrideLoopbackClassification(connection)
  assert.equal(connection.isLoopback, true)
  restore()
  assert.equal(connection.isLoopback, false)
})

test('settings editor accepts one exact origin per line', () => {
  assert.deepEqual(parseTrustedOriginsText(`
    https://dsh.example.com:1443
    https://admin.example.com
  `), [
    'https://dsh.example.com:1443',
    'https://admin.example.com',
  ])
  assert.deepEqual(decodeRemoteSettingsValue({
    trustedOrigins: ['https://dsh.example.com:1443/'],
  }), {
    trustedOrigins: ['https://dsh.example.com:1443'],
  })
  assert.equal(decodeRemoteSettingsValue({ trustedOrigins: ['*'] }), undefined)
})

test('bundle composes settings compatibility and access gateway without executable YAML', () => {
  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(patch, /id:\s*ui-settings[\s\S]*disabled:\s*true/)
  assert.match(patch, /id:\s*connection[\s\S]*disabled:\s*true/)
  assert.match(patch, /id:\s*remote-settings-compat[\s\S]*id:\s*connection-after-remote-compat[\s\S]*id:\s*remote-settings-rpc[\s\S]*id:\s*remote-access-gate[\s\S]*id:\s*ui-settings-after-remote-compat/)
  assert.doesNotMatch(patch, /!!js|ctx\./)
  assert.equal(pkg.exports['./connection'].default, './lib/connection.js')
  assert.equal(pkg.exports['./rpc'].default, './lib/rpc.js')
  assert.equal(pkg.exports['./access'].default, './lib/access/index.js')
  assert.equal(pkg.dsh.client.immediately, true)
  assert.deepEqual(pkg.dsh.client.inject, [])
  assert.equal(pkg.dependencies['@deepseek-ai/dsh-client-connection'], '0.1.1-rc.2')
  assert.equal(pkg.dependencies['@deepseek-ai/dsh-settings'], '0.1.1-rc.2')
  assert.equal(pkg.dependencies['@deepseek-ai/dsh-credentials'], '0.1.1-rc.2')
  assert.equal(pkg.dependencies['http-proxy'], '^1.18.1')
  assert.equal(pkg.dependencies['@lemoncat7/dsh-access-gate'], undefined)
})
