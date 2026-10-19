import {
  isTrustedOrigin,
  TRUSTED_SETTINGS_ATTRIBUTE,
} from './shared.js'
import {
  readTrustedOrigins,
} from './client-core.js'
import { apply as applyRemoteAccessSettings, type RemoteAccessUiContext } from './access/client.js'
import { watchGateAuthentication, type RecoveryConnection } from './access/auth-recovery.js'
import { watchPageResume } from './page-resume.js'

interface ClientContextLike {
  inject(names: string[], callback: (ctx: unknown) => void): unknown
}

interface ConnectionClientContext {
  get(name: 'connection'): RecoveryConnection
  effect(setup: () => void | (() => void), label?: string): unknown
}

export const inject: string[] = []

/** Use the host's native remote settings; observe gateway expiry for trusted pages. */
export function apply(ctx: ClientContextLike): void {
  ctx.inject(['connection'], injected => {
    const connectionCtx = injected as ConnectionClientContext
    connectionCtx.effect(() => {
      if (typeof document === 'undefined' || typeof location === 'undefined') return
      const origins = readTrustedOrigins(document)
      if (!isTrustedOrigin(location.origin, origins)) return

      const connection = connectionCtx.get('connection')
      const stopRecovery = watchGateAuthentication(connection)
      const stopResume = watchPageResume(connection)
      document.documentElement.setAttribute(TRUSTED_SETTINGS_ATTRIBUTE, location.origin)
      return () => {
        stopRecovery()
        stopResume()
        document.documentElement.removeAttribute(TRUSTED_SETTINGS_ATTRIBUTE)
      }
    }, 'remote-settings-compat: classify trusted page origin')
  })

  ctx.inject(['slots', 'configForms'], injected => {
    applyRemoteAccessSettings(injected as RemoteAccessUiContext)
  })
}
