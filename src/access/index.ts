import type { Context } from '@deepseek-ai/cordis'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import { settingsNamespace, type SettingsProvider } from '@deepseek-ai/dsh-settings'
import { registerAdminApi, createSetupToken } from './admin-api.js'
import { ConfigSchema, resolveConfig, type Config as AccessGateConfig } from './config.js'
import { AccessGateway } from './gateway.js'
import { PasswordStore } from './password.js'
import { LoginLimiter, ProxyAssertion } from './security.js'
import { SessionStore } from './sessions.js'

export const Config = ConfigSchema
export type Config = AccessGateConfig
export const name = 'dsh-access-gate'
export const inject = ['credentials', 'settings', 'webServer']

interface RuntimeContext extends Context {
  credentials: CredentialProvider
  settings: SettingsProvider
  webServer: {
    host: string
    port: number
    register(route: {
      kind: 'prefix'
      path: string
      handler(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): void | Promise<void>
    }): () => void
  }
}

export function apply(context: Context, base: AccessGateConfig): void {
  const ctx = context as RuntimeContext
  const scope = ctx.settings.register(
    settingsNamespace('dsh-access-gate'),
    ConfigSchema,
    { base, applies: 'restart', validate: value => { resolveConfig(value) } },
  )
  const config = resolveConfig(scope.get())
  if (config.listenPort === ctx.webServer.port) throw new Error('access gate listenPort must differ from the DSH upstream port')

  const passwords = new PasswordStore(ctx.credentials)
  const sessions = new SessionStore({
    ttlMs: config.sessionTtlMinutes * 60_000,
    idleMs: config.idleTimeoutMinutes * 60_000,
    bindToIp: config.bindSessionToIp,
  })
  const limiter = new LoginLimiter(config.maxFailedAttempts, config.lockoutMinutes * 60_000)
  const assertion = new ProxyAssertion()
  const gateway = new AccessGateway(config, ctx.webServer.port, passwords, sessions, limiter, assertion, ctx.logger)
  const setupToken = createSetupToken()

  ctx.effect(
    () => registerAdminApi({ config, webServer: ctx.webServer, passwords, sessions, assertion, gateway, setupToken }),
    'dsh-access-gate: management API',
  )

  ctx.effect(async () => {
    const configured = await passwords.configured()
    if (!configured) {
      const message = `dsh-access-gate: password is not configured; setup token: ${setupToken}`
      ctx.logger.warn(message)
      // Some DSH Web deployments suppress plugin logger output. The one-time
      // bootstrap secret must remain recoverable by the host operator.
      console.warn(message)
    }
    if (ctx.webServer.host !== '127.0.0.1') {
      ctx.logger.warn(`dsh-access-gate: DSH upstream listens on ${ctx.webServer.host}:${ctx.webServer.port}; do not expose that port outside the trusted host`)
    }
    if (!config.enabled) {
      ctx.logger.info('dsh-access-gate: disabled; configure it in DSH settings and restart')
      return () => Promise.resolve()
    }
    await gateway.start()
    return () => gateway.close()
  }, 'dsh-access-gate: gateway')
}
