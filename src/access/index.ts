import type { Context, Volatile } from '@deepseek-ai/cordis'
import type { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { SettingsForms } from '@deepseek-ai/dsh-settings'
import type { RemoteSettingsTrust } from '../index.js'
import { registerAdminApi, createSetupToken } from './admin-api.js'
import { ConfigSchema, resolveAccessOrigins, resolveConfig, type Config as AccessGateConfig } from './config.js'
import { registerDiagnosticsApi } from './diagnostics.js'
import { AccessGateway } from './gateway.js'
import { PasswordStore } from './password.js'
import { LoginLimiter, ProxyAssertion } from './security.js'
import { SessionStore } from './sessions.js'
import { accessRuntimeConfig } from './runtime-config.js'

export const Config = ConfigSchema.volatile()
export type Config = Volatile<AccessGateConfig>
export const name = 'dsh-access-gate'
export const inject = ['connection', 'credentials', 'settings', 'webServer', 'remoteSettingsTrust']

interface RuntimeContext extends Context {
  credentials: CredentialProvider
  connection: HostConnectionHandle
  settings: SettingsForms
  remoteSettingsTrust: RemoteSettingsTrust
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

export function apply(context: Context, base: Config): void {
  const ctx = context as RuntimeContext
  ctx.effect(() => ctx.settings.configure({ auto: false }))
  const storedConfig = resolveConfig(structuredClone(base.get()) as AccessGateConfig)
  const config = accessRuntimeConfig(base)
  config.publicOrigins = []
  let legacyFallbackActive = ctx.remoteSettingsTrust.origins.length === 0 && storedConfig.publicOrigins.length > 0
  const syncOrigins = (): void => {
    const origins = resolveAccessOrigins(
      ctx.remoteSettingsTrust.origins,
      legacyFallbackActive ? storedConfig.publicOrigins : [],
    )
    config.publicOrigins.splice(0, config.publicOrigins.length, ...origins)
  }
  syncOrigins()
  if (config.listenPort === ctx.webServer.port) throw new Error('access gate listenPort must differ from the DSH upstream port')

  const passwords = new PasswordStore(ctx.credentials)
  const sessions = new SessionStore({
    ttlMs: config.sessionTtlMinutes * 60_000,
    idleMs: config.idleTimeoutMinutes * 60_000,
    bindToIp: config.bindSessionToIp,
  })
  const limiter = new LoginLimiter(config.maxFailedAttempts, config.lockoutMinutes * 60_000)
  const assertion = new ProxyAssertion()
  const gateway = new AccessGateway(config, ctx.webServer.port, passwords, sessions, limiter, assertion, ctx.connection, ctx.logger)
  const setupToken = createSetupToken()

  ctx.effect(
    () => registerAdminApi({
      config,
      webServer: ctx.webServer,
      passwords,
      sessions,
      assertion,
      gateway,
      setupToken,
      trustedOrigins: config.publicOrigins,
      originSource: () => ctx.remoteSettingsTrust.origins.length > 0
        ? 'trustedOrigins'
        : legacyFallbackActive ? 'legacy-publicOrigins' : 'none',
    }),
    'dsh-access-gate: management API',
  )
  ctx.effect(
    () => registerDiagnosticsApi({ config, webServer: ctx.webServer, assertion, trustedOrigins: config.publicOrigins }),
    'dsh-access-gate: deployment diagnostics API',
  )
  ctx.effect(
    () => ctx.remoteSettingsTrust.subscribe(() => {
      legacyFallbackActive = false
      syncOrigins()
    }),
    'dsh-access-gate: trusted origin synchronization',
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
    if (legacyFallbackActive) {
      ctx.logger.warn('dsh-access-gate: using legacy publicOrigins fallback; save the Origin list in the Remote Access card to migrate it')
    }
    if (!config.enabled) {
      ctx.logger.info('dsh-access-gate: disabled; configure it in DSH settings and restart')
      return () => Promise.resolve()
    }
    if (config.listenHost === '0.0.0.0' && config.publicOrigins.length === 0) {
      throw new Error('trustedOrigins must contain at least one exact origin when the access gate listens on 0.0.0.0')
    }
    await gateway.start()
    return () => gateway.close()
  }, 'dsh-access-gate: gateway')
}
