import { normalizeTrustedOrigins } from './shared.js'

export interface RemoteSettingsValue {
  trustedOrigins: string[]
}

export function decodeRemoteSettingsValue(value: unknown): RemoteSettingsValue | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const origins = (value as { trustedOrigins?: unknown }).trustedOrigins
  if (!Array.isArray(origins) || !origins.every(item => typeof item === 'string')) return undefined
  try {
    return { trustedOrigins: normalizeTrustedOrigins(origins) }
  } catch {
    return undefined
  }
}

export function parseTrustedOriginsText(value: string): string[] {
  return normalizeTrustedOrigins(value.split(/[,\n]/u))
}

export function formatTrustedOrigins(origins: readonly string[]): string {
  return origins.join('\n')
}
