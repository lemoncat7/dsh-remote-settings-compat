import Schema from '@deepseek-ai/schemastery'

export interface Config {
  enabled: boolean
  listenHost: '127.0.0.1' | '0.0.0.0'
  listenPort: number
  secureCookies: boolean
  publicOrigins: string[]
  trustedProxyAddresses: string[]
  machineBearerPrefixes: string[]
  sessionTtlMinutes: number
  idleTimeoutMinutes: number
  maxFailedAttempts: number
  lockoutMinutes: number
  bindSessionToIp: boolean
}

export const ConfigSchema: Schema<Config> = Schema.object({
  enabled: Schema.boolean().default(false).description('启用独立密码网关。修改后需重启 DSH。'),
  listenHost: Schema.union(['127.0.0.1', '0.0.0.0']).default('127.0.0.1').description('网关监听地址。反向代理在同机时建议使用 127.0.0.1。'),
  listenPort: Schema.number().min(1).max(65535).default(3081).description('认证网关端口。不得与 DSH 原端口相同。'),
  secureCookies: Schema.boolean().default(true).description('仅通过 HTTPS 发送登录 Cookie；公开部署必须开启。'),
  publicOrigins: Schema.array(Schema.string()).default([]).description('旧版兼容字段。新版统一使用 remote-settings-compat.trustedOrigins，请在「远程访问」卡片中维护。'),
  trustedProxyAddresses: Schema.array(Schema.string()).default([]).description('可信反向代理的精确 IP；仅这些地址可提供真实客户端 IP。'),
  machineBearerPrefixes: Schema.array(Schema.string()).default(['/knowledge-api/v1']).description('允许携带 Bearer Token 独立鉴权的 API 前缀。'),
  sessionTtlMinutes: Schema.number().min(5).max(10080).default(720).description('登录会话最长有效时间（分钟）。'),
  idleTimeoutMinutes: Schema.number().min(1).max(1440).default(60).description('无操作自动退出时间（分钟）。'),
  maxFailedAttempts: Schema.number().min(3).max(20).default(5).description('同一来源连续失败次数上限。'),
  lockoutMinutes: Schema.number().min(1).max(1440).default(15).description('达到失败上限后的锁定时间（分钟）。'),
  bindSessionToIp: Schema.boolean().default(false).description('将会话绑定到登录 IP；移动网络或多出口代理下不建议开启。'),
})

export function resolveConfig(input: Partial<Config>): Config {
  const config: Config = {
    enabled: input.enabled ?? false,
    listenHost: input.listenHost ?? '127.0.0.1',
    listenPort: integer(input.listenPort ?? 3081, 'listenPort', 1, 65535),
    secureCookies: input.secureCookies ?? true,
    publicOrigins: normalizeOrigins(input.publicOrigins ?? []),
    trustedProxyAddresses: normalizeAddresses(input.trustedProxyAddresses ?? []),
    machineBearerPrefixes: normalizePrefixes(input.machineBearerPrefixes ?? ['/knowledge-api/v1']),
    sessionTtlMinutes: integer(input.sessionTtlMinutes ?? 720, 'sessionTtlMinutes', 5, 10080),
    idleTimeoutMinutes: integer(input.idleTimeoutMinutes ?? 60, 'idleTimeoutMinutes', 1, 1440),
    maxFailedAttempts: integer(input.maxFailedAttempts ?? 5, 'maxFailedAttempts', 3, 20),
    lockoutMinutes: integer(input.lockoutMinutes ?? 15, 'lockoutMinutes', 1, 1440),
    bindSessionToIp: input.bindSessionToIp ?? false,
  }
  if (config.idleTimeoutMinutes > config.sessionTtlMinutes) {
    throw new Error('idleTimeoutMinutes must not exceed sessionTtlMinutes')
  }
  return config
}

export function normalizeOrigins(values: readonly string[]): string[] {
  const normalized = new Set<string>()
  for (const raw of values) {
    const value = raw.trim()
    if (value === '') continue
    let url: URL
    try { url = new URL(value) } catch { throw new Error(`invalid public origin: ${value}`) }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`public origin must be an exact HTTP(S) origin: ${value}`)
    }
    normalized.add(url.origin)
  }
  return [...normalized]
}

/** Use the remote-settings namespace as the authority, with legacy gate data as a migration-only fallback. */
export function resolveAccessOrigins(trustedOrigins: readonly string[], legacyPublicOrigins: readonly string[]): string[] {
  return normalizeOrigins(trustedOrigins.length > 0 ? trustedOrigins : legacyPublicOrigins)
}

export function normalizePrefixes(values: readonly string[]): string[] {
  const prefixes = new Set<string>()
  for (const raw of values) {
    const value = raw.trim().replace(/\/+$/u, '')
    if (!/^\/[A-Za-z0-9/_-]+$/u.test(value) || value.includes('//')) throw new Error(`invalid machine API prefix: ${raw}`)
    if (value === '/api' || value === '/plugins' || value === '/assets') throw new Error(`machine API prefix is too broad: ${value}`)
    prefixes.add(value)
  }
  return [...prefixes].sort((a, b) => b.length - a.length)
}

function normalizeAddresses(values: readonly string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function integer(value: number, name: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer between ${min} and ${max}`)
  return value
}
