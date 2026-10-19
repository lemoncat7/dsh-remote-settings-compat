import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'

test('browser bundle registers only its own factory and delegates Connection loading to DSH', () => {
  const registrations = []
  const script = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  vm.runInNewContext(script, { window: { __ModuleLoader__: { load: entry => registrations.push(entry) } } })
  assert.deepEqual(registrations.map(entry => entry.id), [
    '@lemoncat7/dsh-remote-settings-compat',
  ])
  assert.ok(registrations.every(entry => typeof entry.factory === 'function'))
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(pkg.dsh.client.inject, ['@deepseek-ai/dsh-client-connection'])
})
