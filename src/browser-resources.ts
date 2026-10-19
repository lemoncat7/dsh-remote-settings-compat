/** The protected same-origin manifest must use the same cookies as the page. */
export function withManifestCredentials(html: string): string {
  return html.replace(/<link\b[^>]*>/gi, tag => {
    if (!/\brel\s*=\s*(["'])manifest\1/i.test(tag)) return tag
    // Never opt an external manifest into credential forwarding.
    const href = tag.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2]
    if (!href || !/^(?:\.\/|\/)?manifest\.webmanifest(?:\?[^#]*)?$/.test(href)) return tag
    const clean = tag.replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    return clean.replace(/\s*\/?>$/, ' crossorigin="use-credentials">')
  })
}

/** Only content-hashed static JS/CSS; never HTML, API data, redirects or errors. */
export function hashedAssetCachePolicy(method: string | undefined, url: string | undefined,
  status: number | undefined, headers: Record<string, unknown>): string | undefined {
  if (!['GET', 'HEAD'].includes(method ?? '') || status !== 200 || headers['cache-control'] || headers['set-cookie']) return
  if (!/^\/assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/.test(url ?? '')) return
  const type = String(headers['content-type'] ?? '')
  if (!/^(?:text\/(?:javascript|css)|application\/(?:javascript|x-javascript))(?:;|$)/i.test(type)) return
  return 'private, max-age=31536000, immutable'
}
