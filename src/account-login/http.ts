import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config } from '../access/config.js'
import { ProxyAssertion, requestOriginAllowed } from '../access/security.js'
import { readCookie } from '../access/sessions.js'
import { AccountLoginBridge, BridgeError, fail } from './bridge.js'

export const ACCOUNT_LOGIN_PREFIX = '/remote-account-login/v1'
const runtimeVersion: string = createRequire(import.meta.url)('@deepseek-ai/dsh-client-connection/package.json').version
export function accountLoginHandler(bridge: AccountLoginBridge, config: Config, assertion: ProxyAssertion) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      if (req.method !== 'POST') throw fail(405, '请从远程访问设置中操作登录。')
      if (!assertion.verify(single(req.headers['x-dsh-access-assertion'])) || !requestOriginAllowed(req, config)) {
        throw fail(403, '请通过已登录的密码门禁和可信域名使用辅助登录。')
      }
      if (req.headers['x-dsh-account-action'] !== '1' || single(req.headers['content-type'])?.split(';')[0] !== 'application/json') {
        throw fail(403, '登录请求来源不正确，请刷新页面。')
      }
      const action = new URL(req.url ?? '/', 'http://local').pathname.slice(ACCOUNT_LOGIN_PREFIX.length)
      if (!['/status', '/start', '/callback', '/cancel'].includes(action)) throw fail(404, '登录操作不存在。')
      const body = await readBody(req)
      const cookieName = config.secureCookies ? '__Host-dsh_account_bridge' : 'dsh_account_bridge'
      let owner = readCookie(req.headers.cookie, cookieName) ?? ''
      if (!/^[a-zA-Z0-9_-]{43}$/.test(owner)) owner = ''
      if (action === '/start' && !owner) {
        owner = randomBytes(32).toString('base64url')
        res.setHeader('set-cookie', `${cookieName}=${owner}; Path=/; HttpOnly; SameSite=Strict${config.secureCookies ? '; Secure' : ''}`)
      }
      if (!owner && action !== '/status') throw fail(409, '登录凭证已失效，请从当前浏览器重新发起。')
      const result = await bridge.run(async () => {
        if (action === '/start') {
          if (typeof body.locale !== 'string' || body.locale.length > 35 || !Number.isInteger(body.timezoneOffsetSeconds)
            || Math.abs(Number(body.timezoneOffsetSeconds)) > 86400) throw fail(400, '客户端语言或时区格式不正确。')
          return bridge.start(owner, { version: runtimeVersion, locale: body.locale, timezoneOffsetSeconds: Number(body.timezoneOffsetSeconds) })
        }
        if (action === '/callback') return bridge.submit(owner, body.attemptId, body.address)
        if (action === '/cancel') return bridge.cancel(owner, body.attemptId)
        return bridge.status(owner)
      })
      send(res, 200, result)
    } catch (error) {
      const status = error instanceof BridgeError ? error.status : 503
      // Native and network exceptions may contain authorization URLs: never echo or log them.
      send(res, status, { error: status === 503 ? '账号服务暂不可用，请稍后重试。' : error instanceof Error ? error.message : '登录未完成。' })
    }
  }
}
function single(value: string | string[] | undefined): string | undefined { return typeof value === 'string' ? value : undefined }
async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > 12288) throw fail(413, '回调地址过长。')
    chunks.push(buffer)
  }
  let value: unknown
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw fail(400, '请求格式不正确。') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, '请求格式不正确。')
  return value as Record<string, unknown>
}
function send(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(value))
}
