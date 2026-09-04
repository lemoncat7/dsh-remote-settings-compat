import type { Context } from '@deepseek-ai/cordis'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'
import {
  normalizeTrustedOrigins,
  REMOTE_SETTINGS_NAMESPACE,
  trustedAuthorities,
  TRUSTED_ORIGINS_META_NAME,
} from './shared.js'

export interface Config {
  trustedOrigins: string[]
}

export const Config: Schema<Config> = Schema.object({
  trustedOrigins: Schema.array(Schema.string())
    .default([])
    .description('允许使用模型与插件设置的完整浏览器 Origin，例如 https://dsh.example.com:1443。'),
})

export const name = 'dsh-remote-settings-compat'
export const inject = ['settings', 'webServer']

export interface RemoteSettingsTrust {
  readonly origins: readonly string[]
  readonly authorities: readonly string[]
  subscribe(listener: () => void): () => void
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    remoteSettingsTrust: RemoteSettingsTrust
  }
}

interface WebServerLike {
  tapIndex(transform: (html: string) => string): () => void
}

interface RuntimeContextLike extends Context {
  settings: SettingsProvider
  webServer?: WebServerLike
  get(name: 'webServer'): WebServerLike
}

/** Publish the resolved allowlist as inert page metadata before clients boot. */
export function apply(ctx: Context, config: Config): void {
  const runtime = ctx as RuntimeContextLike
  let current = (): Config => config
  const origins = normalizeTrustedOrigins(config.trustedOrigins)
  const authorities = trustedAuthorities(origins)
  const listeners = new Set<() => void>()

  const refreshAuthorities = (): void => {
    const nextOrigins = normalizeTrustedOrigins(current().trustedOrigins)
    origins.splice(0, origins.length, ...nextOrigins)
    authorities.splice(0, authorities.length, ...trustedAuthorities(nextOrigins))
    for (const listener of listeners) listener()
  }

  runtime.settings.installSection(
    ctx,
    REMOTE_SETTINGS_NAMESPACE,
    Config,
    config,
    {
      setSource(source) { current = source },
      onChange() { refreshAuthorities() },
      validate(value) { normalizeTrustedOrigins(value.trustedOrigins) },
    },
  )

  ctx.provide('remoteSettingsTrust', {
    origins,
    authorities,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  })

  const webServer = runtime.webServer ?? runtime.get('webServer')
  ctx.effect(
    () => webServer.tapIndex(html => injectTrustedOriginsMeta(
      html,
      normalizeTrustedOrigins(current().trustedOrigins),
    )),
    'remote-settings-compat: publish trusted origins',
  )
}

export function injectTrustedOriginsMeta(html: string, origins: readonly string[]): string {
  const content = escapeHtmlAttribute(JSON.stringify(origins))
  const meta = `<meta name="${TRUSTED_ORIGINS_META_NAME}" content="${content}">`
  const closingHead = html.search(/<\/head\s*>/i)
  if (closingHead < 0) return `${meta}${html}`
  return `${html.slice(0, closingHead)}${meta}${html.slice(closingHead)}`
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
