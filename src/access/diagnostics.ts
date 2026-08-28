import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config } from './config.js'
import type { ProxyAssertion } from './security.js'

export const DIAGNOSTICS_PREFIX = '/api/remote-access-diagnostics/v1'

interface WebServerLike {
  host: string
  port: number
  register(route: {
    kind: 'prefix'
    path: string
    handler(req: IncomingMessage, res: ServerResponse): void | Promise<void>
  }): () => void
}

export interface RequestDiagnostics {
  browserOrigin?: string
  receivedOrigin?: string
  receivedHost?: string
  forwardedProto?: string
  forwardedPort?: string
  viaGateway: boolean
  trustedOriginMatched: boolean
  originPreserved: boolean
  authorityPreserved: boolean
  secureCookieTransport: boolean
  entry: 'access-gate' | 'raw-upstream'
}

export interface DiagnosticsRuntime {
  config: Config
  webServer: WebServerLike
  assertion: ProxyAssertion
  trustedOrigins: readonly string[]
}

export function registerDiagnosticsApi(runtime: DiagnosticsRuntime): () => void {
  return runtime.webServer.register({
    kind: 'prefix',
    path: DIAGNOSTICS_PREFIX,
    handler(req, res) {
      const pathname = safePathname(req.url)
      if (req.method !== 'POST' || pathname !== `${DIAGNOSTICS_PREFIX}/request`) {
        return sendJson(res, 404, { error: 'not found' })
      }
      return sendJson(res, 200, inspectRequest(runtime, req))
    },
  })
}

export function inspectRequest(runtime: Pick<DiagnosticsRuntime, 'config' | 'assertion' | 'trustedOrigins'>, req: IncomingMessage): RequestDiagnostics {
  const browserOrigin = singleHeader(req.headers['x-dsh-browser-origin'])
  const receivedOrigin = singleHeader(req.headers.origin)
  const receivedHost = singleHeader(req.headers.host)
  const forwardedProto = singleHeader(req.headers['x-forwarded-proto'])
  const forwardedPort = singleHeader(req.headers['x-forwarded-port'])
  const viaGateway = runtime.assertion.verify(singleHeader(req.headers['x-dsh-access-assertion']))
  const expectedAuthority = authorityOf(browserOrigin)
  const receivedOriginCanonical = originOf(receivedOrigin)

  return {
    ...(browserOrigin === undefined ? {} : { browserOrigin }),
    ...(receivedOrigin === undefined ? {} : { receivedOrigin }),
    ...(receivedHost === undefined ? {} : { receivedHost }),
    ...(forwardedProto === undefined ? {} : { forwardedProto }),
    ...(forwardedPort === undefined ? {} : { forwardedPort }),
    viaGateway,
    trustedOriginMatched: receivedOriginCanonical !== undefined && runtime.trustedOrigins.includes(receivedOriginCanonical),
    originPreserved: browserOrigin !== undefined && receivedOriginCanonical === originOf(browserOrigin),
    authorityPreserved: expectedAuthority !== undefined && receivedHost === expectedAuthority,
    secureCookieTransport: !runtime.config.secureCookies || browserOrigin?.startsWith('https://') === true,
    entry: viaGateway ? 'access-gate' : 'raw-upstream',
  }
}

function authorityOf(value: string | undefined): string | undefined {
  try { return value === undefined ? undefined : new URL(value).host } catch { return undefined }
}

function originOf(value: string | undefined): string | undefined {
  try { return value === undefined ? undefined : new URL(value).origin } catch { return undefined }
}

function safePathname(value: string | undefined): string | undefined {
  try { return new URL(value ?? '/', 'http://dsh.internal').pathname } catch { return undefined }
}

function singleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(JSON.stringify(value))
}
