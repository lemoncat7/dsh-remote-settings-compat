import type { Context } from '@deepseek-ai/cordis'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { RemoteSettingsTrust } from './index.js'

export const name = 'dsh-remote-settings-rpc'
export const inject = ['webServer', 'apiProxy', 'remoteSettingsTrust']

const MAX_SETTINGS_BODY_BYTES = 2 * 1024 * 1024
interface RpcResultLike {
  ok: boolean
  value?: unknown
  error?: unknown
}

interface ApiResponseLike {
  rpcId?: string
  result: RpcResultLike
}

type ApiMethodLike = (
  request: { rpcId: string; payload: unknown },
  signal?: AbortSignal,
) => Promise<ApiResponseLike>

interface ApiProxyLike {
  settings: Record<string, ApiMethodLike>
  credentials: Record<string, ApiMethodLike>
  llm: Record<string, ApiMethodLike>
}

const REMOTE_API_METHODS = new Map<string, readonly [keyof ApiProxyLike, string]>([
  ['settings.describe', ['settings', 'describe']],
  ['settings.update', ['settings', 'update']],
  ['settings.replace', ['settings', 'replace']],
  ['settings.mutate', ['settings', 'mutate']],
  ['credentials.describe', ['credentials', 'describe']],
  ['credentials.set', ['credentials', 'set']],
  ['credentials.unset', ['credentials', 'unset']],
  ['llm.discoverModels', ['llm', 'discoverModels']],
])

interface WebRoute {
  kind: 'exact'
  path: string
  handler(req: IncomingMessage, res: ServerResponse): Promise<void>
}

interface RpcRuntimeContext {
  webServer: { register(route: WebRoute): () => void }
  apiProxy: ApiProxyLike
  remoteSettingsTrust: RemoteSettingsTrust
}

/**
 * Register only the legacy privileged endpoints the official Connection pins
 * to loopback. Exact routes compose with DSH's existing /api prefix and leave
 * every unrelated endpoint untouched.
 */
export function apply(ctx: Context): void {
  const runtime = ctx as unknown as RpcRuntimeContext
  for (const method of REMOTE_API_METHODS.keys()) {
    const path = `/api/${method}`
    ctx.effect(
      () => runtime.webServer.register({
        kind: 'exact',
        path,
        handler: (req, res) => handleRequest(
          runtime.remoteSettingsTrust,
          runtime.apiProxy,
          method,
          req,
          res,
        ),
      }),
      `remote-settings-compat: ${path}`,
    )
  }
}

async function handleRequest(
  trust: RemoteSettingsTrust,
  apiProxy: ApiProxyLike,
  expectedMethod: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (!isTrustedRequest(req.headers, trust)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }

  const body = await readBody(req, MAX_SETTINGS_BODY_BYTES)
  if (body === undefined) {
    res.writeHead(413, { connection: 'close' })
    res.end()
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(404)
    res.end('not found')
    return
  }
  if (header(req.headers, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    res.writeHead(415)
    res.end('content type must be application/json')
    return
  }

  let message: unknown
  try {
    message = JSON.parse(body.toString('utf8'))
  } catch {
    res.writeHead(400)
    res.end('body is not JSON')
    return
  }
  const envelope = readEnvelope(message)
  if (envelope === undefined) {
    writeRpcResponse(res, rpcIdOf(message), rpcError('bad-request', 'invalid client-request message'))
    return
  }
  if (envelope.method !== expectedMethod) {
    writeRpcResponse(
      res,
      envelope.rpcId,
      rpcError('bad-request', `method ${JSON.stringify(envelope.method)} does not match endpoint ${JSON.stringify(expectedMethod)}`),
    )
    return
  }

  const binding = REMOTE_API_METHODS.get(expectedMethod)
  const method = binding === undefined ? undefined : apiProxy[binding[0]][binding[1]]
  if (method === undefined) {
    writeRpcResponse(res, envelope.rpcId, rpcError('internal', `DSH API endpoint is unavailable: ${expectedMethod}`))
    return
  }

  const abort = new AbortController()
  const onClose = (): void => {
    if (!res.writableEnded) abort.abort()
  }
  res.once('close', onClose)
  try {
    const response = await method({
      rpcId: envelope.rpcId,
      payload: envelope.payload,
    }, abort.signal)
    writeRpcResponse(res, response.rpcId ?? envelope.rpcId, response.result)
  } catch (error) {
    res.writeHead(500)
    res.end(`handler failure: ${String(error)}`)
  } finally {
    res.off('close', onClose)
  }
}

interface ClientEnvelope {
  type: 'client-request'
  rpcId: string
  method: string
  payload: unknown
}

function readEnvelope(value: unknown): ClientEnvelope | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const message = value as Partial<ClientEnvelope>
  if (message.type !== 'client-request'
    || typeof message.rpcId !== 'string'
    || typeof message.method !== 'string'
    || !Object.hasOwn(message, 'payload')) return undefined
  return message as ClientEnvelope
}

function rpcIdOf(value: unknown): string {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const rpcId = (value as { rpcId?: unknown }).rpcId
    if (typeof rpcId === 'string') return rpcId
  }
  return 'invalid-request'
}

function rpcError(code: string, message: string): RpcResultLike {
  return { ok: false, error: { code, message, details: { issues: [] } } }
}

function writeRpcResponse(res: ServerResponse, rpcId: string, result: RpcResultLike): void {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ type: 'server-response', rpcId, result }))
}

function isTrustedRequest(headers: IncomingHttpHeaders, trust: RemoteSettingsTrust): boolean {
  if (header(headers, 'sec-fetch-site') === 'cross-site') return false
  const authority = header(headers, 'host')
  if (authority === undefined) return false

  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${authority}`)
  } catch {
    return false
  }

  const origin = header(headers, 'origin')
  if (isLoopbackHostname(hostUrl.hostname)) {
    if (origin === undefined) return true
    try {
      return new URL(origin).host === hostUrl.host
    } catch {
      return false
    }
  }
  if (origin === undefined || !trust.authorities.includes(hostUrl.host)) return false
  try {
    const originUrl = new URL(origin)
    return originUrl.host === hostUrl.host && trust.origins.includes(originUrl.origin)
  } catch {
    return false
  }
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/u.test(part) && Number(part) <= 255)
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer | undefined> {
  const declared = req.headers['content-length']
  if (declared !== undefined && Number(declared) > limit) return undefined
  const chunks: Buffer[] = []
  let received = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    received += buffer.byteLength
    if (received > limit) return undefined
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}
