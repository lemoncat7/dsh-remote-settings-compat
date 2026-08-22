import {
  normalizeTrustedOrigins,
  TRUSTED_ORIGINS_META_NAME,
} from './shared.js'

export interface ConnectionLike {
  isLoopback: boolean
}

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

/** Override the writable runtime field and retain an exact lifecycle rollback. */
export function overrideLoopbackClassification(connection: ConnectionLike): () => void {
  if (connection.isLoopback) return () => {}
  const descriptor = Object.getOwnPropertyDescriptor(connection, 'isLoopback')
  if (descriptor !== undefined && descriptor.configurable === false && descriptor.writable === false) {
    throw new Error('connection.isLoopback cannot be overridden by this DSH version')
  }
  Object.defineProperty(connection, 'isLoopback', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    writable: true,
    value: true,
  })
  return () => {
    if (descriptor === undefined) delete (connection as Partial<ConnectionLike>).isLoopback
    else Object.defineProperty(connection, 'isLoopback', descriptor)
  }
}
