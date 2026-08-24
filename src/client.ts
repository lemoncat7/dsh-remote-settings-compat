import {
  isTrustedOrigin,
  TRUSTED_SETTINGS_ATTRIBUTE,
} from './shared.js'
import {
  overrideLoopbackClassification,
  readTrustedOrigins,
  type ConnectionLike,
} from './client-core.js'
import { apply as applyRemoteAccessSettings, type RemoteAccessUiContext } from './access/client.js'

interface ClientContextLike {
  inject(names: string[], callback: (ctx: unknown) => void): unknown
}

interface ConnectionClientContext {
  get(name: 'connection'): ConnectionLike
  effect(setup: () => void | (() => void), label?: string): unknown
}

export const inject: string[] = []

interface OfficialConnectionModule {
  apply(ctx: unknown): void
}

/** Mark only an explicitly configured page origin before ui-settings boots. */
export function apply(ctx: ClientContextLike): void {
  const officialConnection = require('@deepseek-ai/dsh-client-connection') as OfficialConnectionModule
  officialConnection.apply(ctx)

  ctx.inject(['connection'], injected => {
    const connectionCtx = injected as ConnectionClientContext
    connectionCtx.effect(() => {
      if (typeof document === 'undefined' || typeof location === 'undefined') return
      const origins = readTrustedOrigins(document)
      if (!isTrustedOrigin(location.origin, origins)) return

      const connection = connectionCtx.get('connection')
      const restore = overrideLoopbackClassification(connection)
      document.documentElement.setAttribute(TRUSTED_SETTINGS_ATTRIBUTE, location.origin)
      return () => {
        restore()
        document.documentElement.removeAttribute(TRUSTED_SETTINGS_ATTRIBUTE)
      }
    }, 'remote-settings-compat: classify trusted page origin')
  })

  ctx.inject(['slots', 'settingsScope'], injected => {
    applyRemoteAccessSettings(injected as RemoteAccessUiContext)
  })
}
