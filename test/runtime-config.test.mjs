import test from 'node:test'
import assert from 'node:assert/strict'
import { accessRuntimeConfig } from '../lib/access/runtime-config.js'
import { resolveConfig } from '../lib/access/config.js'

test('anonymous sharing toggles live without rebuilding socket or session policy', () => {
  let value = resolveConfig({ listenPort: 3081, allowAnonymousKnowledgeShares: false })
  const config = accessRuntimeConfig({ get: () => value })
  assert.equal(config.allowAnonymousKnowledgeShares, false)
  value = { ...value, allowAnonymousKnowledgeShares: true, listenPort: 4000, sessionTtlMinutes: 900 }
  assert.equal(config.allowAnonymousKnowledgeShares, true)
  assert.equal(config.listenPort, 3081)
  assert.equal(config.sessionTtlMinutes, 720)
  value = { ...value, allowAnonymousKnowledgeShares: false }
  assert.equal(config.allowAnonymousKnowledgeShares, false)
})
