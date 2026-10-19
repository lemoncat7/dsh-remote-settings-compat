import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { composeEntries } from '@deepseek-ai/dsh-app-boot'
import { refreshNativeConnection } from '../lib/connection.js'

test('real DSH composition accepts native patch and adds non-CLI authorities', () => {
  const warnings = []
  const patches = parse(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), {
    customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => ({ __jsExpr: value }) }],
  })
  const entries = composeEntries([[{ insert: [
    { id: 'connection', name: '@deepseek-ai/dsh-client-connection', config: {} },
    { id: 'ui-settings', name: '@deepseek-ai/dsh-client-ui-settings' },
  ] }], patches], warning => warnings.push(warning))
  assert.deepEqual(warnings, [])
  const connection = entries.find(entry => entry.id === 'connection')
  assert.equal(connection.name, '@deepseek-ai/dsh-client-connection')
  assert.deepEqual(connection.inject, ['webStartup', 'remoteSettingsTrust'])
  const resolve = new Function('ctx', `return (${connection.config.trustedHosts.__jsExpr})`)
  assert.deepEqual(resolve({ webStartup: { trustedHosts: ['cli.example:8443'] }, remoteSettingsTrust: { authorities: ['plugin-only.example:1443'] } }), ['cli.example:8443', 'plugin-only.example:1443'])
})

test('refresh re-evaluates native raw policy without dropping user options or writing config', () => {
  const config = { trustedHosts: { __jsExpr: 'ctx.remoteSettingsTrust.authorities' }, cookieMaxAgeDays: 7, maxRequestBodyBytes: 400000000, recovery: { backoffBaseMs: 1000 } }
  const calls = []
  refreshNativeConnection({ *entries() {
    yield { options: { id: 'unrelated', name: 'other' }, fiber: { update() { throw new Error('unrelated') } } }
    yield { options: { id: 'connection', name: '@deepseek-ai/dsh-client-connection', config }, fiber: { update(...args) { calls.push(args) } } }
  } })
  assert.deepEqual(calls, [[config, true]])
  assert.equal(calls[0][0], config)
  assert.doesNotThrow(() => refreshNativeConnection(undefined))
})
