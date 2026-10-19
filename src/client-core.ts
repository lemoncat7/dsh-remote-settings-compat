import {
  normalizeTrustedOrigins,
  TRUSTED_ORIGINS_META_NAME,
} from './shared.js'

export function readTrustedOrigins(doc: Pick<Document, 'querySelector'>): string[] {
  const meta = doc.querySelector<HTMLMetaElement>(`meta[name="${TRUSTED_ORIGINS_META_NAME}"]`)
  const content = meta?.content
  if (content === undefined || content.length === 0) return []
  try {
    const parsed: unknown = JSON.parse(content)
    return Array.isArray(parsed) && parsed.every(value => typeof value === 'string')
      ? normalizeTrustedOrigins(parsed)
      : []
  } catch {
    return []
  }
}
