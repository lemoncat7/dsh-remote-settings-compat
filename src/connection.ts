import type { Context } from '@deepseek-ai/cordis'
import { apply as applyConnection } from '@deepseek-ai/dsh-client-connection'
import type { RemoteSettingsTrust } from './index.js'

export const name = 'dsh-remote-settings-connection'
export const inject = ['webServer', 'webRuntime', 'remoteSettingsTrust']

interface ConnectionRuntimeContext {
  webRuntime: { trustedHosts: readonly string[] }
  remoteSettingsTrust: RemoteSettingsTrust
}

/**
 * Recreate DSH's official Connection with deployment hosts and the authorities
 * derived from trustedOrigins. The same array is updated in place so settings
 * changes do not require replacing the HTTP route.
 */
export function apply(ctx: Context): void {
  const runtime = ctx as unknown as ConnectionRuntimeContext
  const trustedHosts: string[] = []
  const refresh = (): void => {
    const merged = new Set([
      ...runtime.webRuntime.trustedHosts,
      ...runtime.remoteSettingsTrust.authorities,
    ])
    trustedHosts.splice(0, trustedHosts.length, ...merged)
  }

  refresh()
  applyConnection(ctx, { trustedHosts })
  ctx.effect(
    () => runtime.remoteSettingsTrust.subscribe(refresh),
    'remote-settings-compat: synchronize Connection authorities',
  )
}
