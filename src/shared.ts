export const TRUSTED_ORIGINS_META_NAME = 'dsh-remote-settings-trusted-origins'
export const TRUSTED_SETTINGS_ATTRIBUTE = 'data-dsh-remote-settings-compat'
export const REMOTE_SETTINGS_NAMESPACE = 'remote-settings-compat'

/** Canonicalize exact HTTP(S) origins and reject paths, credentials and wildcards. */
export function normalizeTrustedOrigins(values: readonly string[] | undefined): string[] {
  const origins = new Set<string>()
  for (const value of values ?? []) {
    const input = value.trim()
    if (input.length === 0) continue
    if (input.includes('*')) throw new Error(`trusted origin must not contain a wildcard: ${input}`)

    let url: URL
    try {
      url = new URL(input)
    } catch {
      throw new Error(`invalid trusted origin: ${input}`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`trusted origin must use HTTP or HTTPS: ${input}`)
    }
    if (url.username !== '' || url.password !== '') {
      throw new Error(`trusted origin must not contain credentials: ${input}`)
    }
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
      throw new Error(`trusted origin must not contain a path, query or fragment: ${input}`)
    }
    origins.add(url.origin)
  }
  return [...origins]
}

export function isTrustedOrigin(currentOrigin: string, trustedOrigins: readonly string[]): boolean {
  let canonical: string
  try {
    canonical = new URL(currentOrigin).origin
  } catch {
    return false
  }
  return trustedOrigins.includes(canonical)
}

/** Convert exact browser origins into the bare authorities used by DSH's Host fence. */
export function trustedAuthorities(trustedOrigins: readonly string[]): string[] {
  return [...new Set(normalizeTrustedOrigins(trustedOrigins).map(origin => new URL(origin).host))]
}
