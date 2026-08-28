import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import cssText from './client.css'
import type { Config } from './config.js'
import { decodeRemoteSettingsValue, type RemoteSettingsValue } from '../client-settings.js'
import { REMOTE_SETTINGS_NAMESPACE } from '../shared.js'

const PLUGIN_ID = '@lemoncat7/dsh-remote-settings-compat'
const NAMESPACE = 'dsh-access-gate'
const ADMIN_PREFIX = '/access-gate-admin/v1'
const DIAGNOSTICS_PATH = '/api/remote-access-diagnostics/v1/request'
const STYLE_ID = `${PLUGIN_ID}/remote-access-settings`

interface SettingsSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  writable: boolean
}

interface SettingsScope<T> {
  getSnapshot(): SettingsSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

export interface RemoteAccessUiContext {
  slots: {
    inject(name: string, register: () => unknown): unknown
    register(options: Record<string, unknown>, component: () => JSX.Element): unknown
  }
  settingsScope: {
    bind<T>(spec: { namespace: string; decode(value: unknown): T | undefined }): SettingsScope<T>
  }
  effect(setup: () => void | (() => void), label?: string): unknown
}

interface GateStatus {
  configured: boolean
  credentialStoreWritable: boolean
  gatewayEnabled: boolean
  gatewayRunning: boolean
  listenHost: string
  listenPort: number
  upstreamHost: string
  upstreamPort: number
  activeSessions: number
  trustedOriginCount: number
  originSource: 'trustedOrigins' | 'legacy-publicOrigins' | 'none'
  viaGateway: boolean
  entry: 'access-gate' | 'raw-upstream'
  gatewayStats: {
    requestCount: number
    webSocketCount: number
    lastRequestAt?: number
  }
  rawUpstreamExposurePossible: boolean
}

interface RequestDiagnostics {
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

interface DiagnosticIssue {
  severity: 'danger' | 'warning'
  title: string
  detail: string
}

export const inject = ['slots', 'settingsScope']

export function apply(ctx: RemoteAccessUiContext): void {
  const gateScope = ctx.settingsScope.bind<Config>({ namespace: NAMESPACE, decode: decodeConfig })
  const remoteScope = ctx.settingsScope.bind<RemoteSettingsValue>({ namespace: REMOTE_SETTINGS_NAMESPACE, decode: decodeRemoteSettingsValue })
  ctx.effect(installStyles, 'remote-access: settings styles')
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: REMOTE_SETTINGS_NAMESPACE,
  }, () => <RemoteAccessCard gateScope={gateScope} remoteScope={remoteScope} />))
}

function RemoteAccessCard({ gateScope, remoteScope }: { gateScope: SettingsScope<Config>; remoteScope: SettingsScope<RemoteSettingsValue> }) {
  const gateSnapshot = useSyncExternalStore(listener => gateScope.subscribe(listener), () => gateScope.getSnapshot())
  const remoteSnapshot = useSyncExternalStore(listener => remoteScope.subscribe(listener), () => remoteScope.getSnapshot())
  const config = gateSnapshot.value
  const remoteConfig = remoteSnapshot.value
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Config>(() => config ?? defaultConfig())
  const [status, setStatus] = useState<GateStatus>()
  const [diagnostics, setDiagnostics] = useState<RequestDiagnostics>()
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>()
  const [setupToken, setSetupToken] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (config === undefined || saving) return
    const publicOrigins = (remoteConfig?.trustedOrigins.length ?? 0) > 0
      ? remoteConfig?.trustedOrigins ?? []
      : config.publicOrigins
    setDraft({ ...config, publicOrigins })
  }, [config, remoteConfig, saving])

  const reloadStatus = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const [nextStatus, nextDiagnostics] = await Promise.all([
        adminRequest<GateStatus>('GET', 'status'),
        diagnosticsRequest(),
      ])
      setStatus(nextStatus)
      setDiagnostics(nextDiagnostics)
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => { void reloadStatus() }, [reloadStatus])

  const originsText = draft.publicOrigins.join('\n')
  const proxiesText = draft.trustedProxyAddresses.join('\n')
  const prefixesText = draft.machineBearerPrefixes.join('\n')
  const configError = useMemo(() => validateDraft(draft), [draft])
  const passwordError = password.length > 0 && password.length < 6
    ? '新密码至少需要 6 个字符。'
    : password !== confirmPassword ? '两次输入的密码不一致。' : undefined
  const gateFields = (Object.keys(draft) as Array<keyof Config>).filter(field => field !== 'publicOrigins')
  const gateDirty = config !== undefined && gateFields.some(field => JSON.stringify(config[field]) !== JSON.stringify(draft[field]))
  const remoteDirty = remoteConfig !== undefined && JSON.stringify(remoteConfig.trustedOrigins) !== JSON.stringify(draft.publicOrigins)
  const migrationPending = (config?.publicOrigins.length ?? 0) > 0
  const dirty = gateDirty || remoteDirty || migrationPending
  const writable = (!(gateDirty || migrationPending) || gateSnapshot.writable) && (!remoteDirty || remoteSnapshot.writable)
  const dockerLoopbackWarning = draft.enabled
    && status?.upstreamHost === '0.0.0.0'
    && draft.listenHost === '127.0.0.1'

  const edit = <K extends keyof Config>(field: K, value: Config[K]): void => {
    setDraft(current => ({ ...current, [field]: value }))
    setMessage(undefined)
  }

  const saveConfig = async (): Promise<void> => {
    if (!dirty || configError !== undefined || !writable || saving) return
    setSaving(true)
    setMessage(undefined)
    try {
      if (remoteDirty) await remoteScope.set('trustedOrigins', draft.publicOrigins)
      const changed = gateFields.filter(field => JSON.stringify(draft[field]) !== JSON.stringify(config?.[field]))
      for (const field of changed) await gateScope.set(field, draft[field])
      if (migrationPending) await gateScope.set('publicOrigins', [])
      setMessage({ kind: 'success', text: '远程访问配置已保存。可信地址立即同步；网关监听设置在重启 DSH 后生效。' })
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (): Promise<void> => {
    if (passwordError !== undefined || password.length === 0 || saving) return
    setSaving(true)
    setMessage(undefined)
    try {
      await adminRequest('PUT', 'password', {
        password,
        ...(status?.configured ? { currentPassword } : { setupToken }),
      })
      setPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setSetupToken('')
      await reloadStatus()
      setMessage({ kind: 'success', text: status?.configured ? '密码已更换，所有旧会话已撤销。' : '门禁密码已设置。' })
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const revokeSessions = async (): Promise<void> => {
    setSaving(true)
    setMessage(undefined)
    try {
      await adminRequest('POST', 'sessions/revoke', {})
      await reloadStatus()
      setMessage({ kind: 'success', text: '所有登录会话已撤销。' })
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  const diagnosticIssues = diagnostics === undefined || status === undefined ? [] : deploymentIssues(status, diagnostics)
  const summary = loadingStatus ? '检测中' : diagnosticIssues.some(issue => issue.severity === 'danger') ? '部署异常' : status?.gatewayRunning ? `运行于 ${status.listenPort}` : draft.enabled ? '等待重启' : '未启用'

  return <li className={`dsh-access-gate-card${open ? ' is-open' : ''}`}>
    <button type="button" className="dsh-access-gate-header" aria-expanded={open} onClick={() => { setOpen(value => !value) }}>
      <span><strong>远程访问</strong><small>可信远程设置、密码门禁与机器 API 的统一入口</small></span>
      <span className="dsh-access-gate-summary"><i data-running={status?.gatewayRunning ? 'true' : 'false'} />{summary}<b aria-hidden="true" /></span>
    </button>
    {open && <div className="dsh-access-gate-body">
      <div className="dsh-access-gate-warning"><strong>部署边界</strong><span>对外反向代理应指向门禁端口；DSH 原端口必须只允许可信主机访问，否则可以绕过密码。</span></div>

      <DeploymentDiagnostics status={status} diagnostics={diagnostics} issues={diagnosticIssues} loading={loadingStatus} onReload={() => { void reloadStatus() }} />

      {gateSnapshot.status === 'unavailable' || remoteSnapshot.status === 'unavailable' ? <p className="dsh-access-gate-message" data-kind="error">当前浏览器没有远程访问设置写入权限。</p> : <>
        <section>
          <div className="dsh-access-gate-section-title"><span><strong>可信访问与网关</strong><small>同一地址列表同时控制登录来源和 DSH 官方设置权限</small></span><Switch ariaLabel="启用访问密码门禁" checked={draft.enabled} disabled={!writable} onChange={value => { edit('enabled', value) }} /></div>
          <div className="dsh-access-gate-grid">
            <Field label="监听地址"><select value={draft.listenHost} disabled={!writable} onChange={event => { edit('listenHost', event.target.value as Config['listenHost']) }}><option value="127.0.0.1">127.0.0.1（同机反代）</option><option value="0.0.0.0">0.0.0.0（局域网/容器）</option></select></Field>
            <Field label="门禁端口"><input type="number" min={1} max={65535} value={draft.listenPort} disabled={!writable} onChange={event => { edit('listenPort', Number(event.target.value)) }} /></Field>
          </div>
          <Field label="公开可信 Origin" help="这是唯一权威地址列表：同时用于登录校验与远程设置权限。每行一个完整 Origin，非默认端口必须保留端口。"><textarea value={originsText} placeholder="https://dsh.example.com:1443" disabled={!remoteSnapshot.writable} onChange={event => { edit('publicOrigins', lines(event.target.value)) }} /></Field>
          <ToggleRow label="仅 HTTPS Cookie" help="公开部署必须开启；仅本机 HTTP 测试时关闭。" checked={draft.secureCookies} disabled={!writable} onChange={value => { edit('secureCookies', value) }} />
          {dockerLoopbackWarning && <p className="dsh-access-gate-message" data-kind="warning">当前是 Docker 部署，监听 127.0.0.1 只能在容器内部访问。请改为 0.0.0.0，并填写公开 Origin。</p>}
        </section>

        <section>
          <div className="dsh-access-gate-section-title"><span><strong>Knowledge 与代理</strong><small>机器 Token 仍由对应插件验证</small></span></div>
          <Field label="机器 Bearer API 前缀" help="默认只放行 Knowledge API。不要填写 /api、/assets 等宽泛路径。"><textarea value={prefixesText} disabled={!writable} onChange={event => { edit('machineBearerPrefixes', lines(event.target.value)) }} /></Field>
          <Field label="可信反向代理 IP" help="每行一个精确 IP；只有这些来源的 X-Real-IP 会被信任。"><textarea value={proxiesText} placeholder="127.0.0.1" disabled={!writable} onChange={event => { edit('trustedProxyAddresses', lines(event.target.value)) }} /></Field>
        </section>

        {!status?.gatewayRunning && <FirstRunChecklist configured={status?.configured === true} />}

        <section>
          <div className="dsh-access-gate-section-title"><span><strong>会话安全</strong><small>{status ? `${status.activeSessions} 个活动会话` : '状态读取中'}</small></span></div>
          <div className="dsh-access-gate-grid dsh-access-gate-grid--three">
            <Field label="最长时限（分钟）"><input type="number" min={5} max={10080} value={draft.sessionTtlMinutes} disabled={!writable} onChange={event => { edit('sessionTtlMinutes', Number(event.target.value)) }} /></Field>
            <Field label="空闲退出（分钟）"><input type="number" min={1} max={1440} value={draft.idleTimeoutMinutes} disabled={!writable} onChange={event => { edit('idleTimeoutMinutes', Number(event.target.value)) }} /></Field>
            <Field label="失败上限"><input type="number" min={3} max={20} value={draft.maxFailedAttempts} disabled={!writable} onChange={event => { edit('maxFailedAttempts', Number(event.target.value)) }} /></Field>
          </div>
          <div className="dsh-access-gate-grid">
            <Field label="锁定时间（分钟）"><input type="number" min={1} max={1440} value={draft.lockoutMinutes} disabled={!writable} onChange={event => { edit('lockoutMinutes', Number(event.target.value)) }} /></Field>
            <ToggleRow label="会话绑定 IP" help="多出口网络不建议开启。" checked={draft.bindSessionToIp} disabled={!writable} onChange={value => { edit('bindSessionToIp', value) }} compact />
          </div>
        </section>

        <section>
          <div className="dsh-access-gate-section-title"><span><strong>{status?.configured ? '更换密码' : '初始化密码'}</strong><small>密码只以 scrypt 校验值存入 DSH Credentials</small></span></div>
          {!status?.configured && <Field label="初始化令牌" help="令牌仅输出在本次 DSH 启动日志中。"><input type="password" value={setupToken} autoComplete="off" onChange={event => { setSetupToken(event.target.value); setMessage(undefined) }} /></Field>}
          {status?.configured && <Field label="当前密码"><input type="password" value={currentPassword} autoComplete="current-password" onChange={event => { setCurrentPassword(event.target.value); setMessage(undefined) }} /></Field>}
          <div className="dsh-access-gate-grid">
            <Field label="新密码" help="至少 6 个字符；公开部署建议使用 12 个字符以上。"><input type="password" minLength={6} maxLength={1024} value={password} autoComplete="new-password" onChange={event => { setPassword(event.target.value); setMessage(undefined) }} /></Field>
            <Field label="确认新密码"><input type="password" minLength={6} maxLength={1024} value={confirmPassword} autoComplete="new-password" onChange={event => { setConfirmPassword(event.target.value); setMessage(undefined) }} /></Field>
          </div>
          {passwordError && <p className="dsh-access-gate-message" data-kind="error">{passwordError}</p>}
          <div className="dsh-access-gate-actions">
            {status?.configured && <button type="button" disabled={saving || !status.gatewayRunning} onClick={() => { void revokeSessions() }}>撤销全部会话</button>}
            <button type="button" className="is-primary" disabled={saving || password.length === 0 || passwordError !== undefined || (status?.configured ? currentPassword.length === 0 : setupToken.length === 0)} onClick={() => { void savePassword() }}>{saving ? '处理中…' : status?.configured ? '更换密码' : '设置密码'}</button>
          </div>
        </section>

        {configError && <p className="dsh-access-gate-message" data-kind="error">{configError}</p>}
        {message && <p className="dsh-access-gate-message" data-kind={message.kind} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
        <div className="dsh-access-gate-savebar"><span>{dirty ? '配置有未保存的修改' : '可信地址与网关配置已同步'}</span><button type="button" className="is-primary" disabled={!dirty || configError !== undefined || !writable || saving} onClick={() => { void saveConfig() }}>{saving ? '保存中…' : '保存远程访问配置'}</button></div>
      </>}
    </div>}
  </li>
}

function DeploymentDiagnostics({ status, diagnostics, issues, loading, onReload }: {
  status: GateStatus | undefined
  diagnostics: RequestDiagnostics | undefined
  issues: DiagnosticIssue[]
  loading: boolean
  onReload(): void
}) {
  const ready = status !== undefined && diagnostics !== undefined
  const dangerCount = issues.filter(issue => issue.severity === 'danger').length
  const healthy = ready && dangerCount === 0
  return <section className="dsh-access-gate-diagnostics" aria-label="部署自检">
    <div className="dsh-access-gate-diagnostics-head">
      <span><strong>部署自检</strong><small>{loading ? '正在检查当前入口…' : dangerCount > 0 ? `${dangerCount} 项需要处理` : issues.length > 0 ? `当前入口正常 · ${issues.length} 项边界待确认` : '当前入口与反向代理正常'}</small></span>
      <button type="button" disabled={loading} onClick={onReload}>{loading ? '检测中…' : '重新检测'}</button>
    </div>
    {ready && <div className="dsh-access-gate-diagnostic-facts">
      <DiagnosticFact label="当前入口" value={diagnostics.entry === 'access-gate' ? `密码门禁 · ${status.listenPort}` : `原始 DSH · ${status.upstreamPort}`} ok={diagnostics.viaGateway} />
      <DiagnosticFact label="Host 与端口" value={diagnostics.receivedHost ?? '未收到'} ok={diagnostics.authorityPreserved} />
      <DiagnosticFact label="Origin" value={diagnostics.receivedOrigin ?? '未收到'} ok={diagnostics.originPreserved && diagnostics.trustedOriginMatched} />
      <DiagnosticFact label="Credentials" value={status.credentialStoreWritable ? '可写' : '不可写'} ok={status.credentialStoreWritable} />
    </div>}
    {!loading && issues.length > 0 && <div className="dsh-access-gate-diagnostic-issues" role="status">
      {issues.map(issue => <div key={`${issue.title}:${issue.detail}`} data-severity={issue.severity}><i aria-hidden="true" /><span><strong>{issue.title}</strong><small>{issue.detail}</small></span></div>)}
    </div>}
  </section>
}

function DiagnosticFact({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <span className="dsh-access-gate-diagnostic-fact" data-ok={ok ? 'true' : 'false'}><small>{label}</small><strong title={value}>{value}</strong></span>
}

function FirstRunChecklist({ configured }: { configured: boolean }) {
  return <details className="dsh-access-gate-checklist">
    <summary><span><strong>首次启用顺序</strong><small>按阶段切换，避免把自己锁在门外</small></span><i aria-hidden="true" /></summary>
    <ol>
      <li>填写完整的可信 Origin，启用门禁并保存。</li>
      <li>{configured ? '密码已初始化。' : '使用本次启动日志中的令牌初始化密码。'}</li>
      <li>发布并重启 3081，确认门禁健康。</li>
      <li>把反向代理整体从 3080 切到 3081，不要单独分流 /api/。</li>
      <li>最后移除 3080 的对外发布，再运行部署自检。</li>
    </ol>
  </details>
}

function deploymentIssues(status: GateStatus, diagnostics: RequestDiagnostics): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = []
  if (status.gatewayEnabled && !status.gatewayRunning) issues.push({ severity: 'danger', title: '门禁未运行', detail: '配置已启用但端口尚未监听，请查看启动日志并重启 DSH。' })
  if (!diagnostics.viaGateway) issues.push({ severity: 'danger', title: '当前请求绕过了密码门禁', detail: `请把整个站点反代到 ${status.listenPort}，并停止对外发布 ${status.upstreamPort}。` })
  if (status.rawUpstreamExposurePossible) issues.push({ severity: 'warning', title: '原始 DSH 监听在公开地址', detail: `${status.upstreamHost}:${status.upstreamPort} 可能成为绕过入口；Docker 请将宿主机发布收紧到 127.0.0.1。` })
  if (!diagnostics.authorityPreserved) issues.push({ severity: 'danger', title: 'Host 端口丢失', detail: '反向代理必须使用 proxy_set_header Host $http_host，不能使用 $host。' })
  if (!diagnostics.originPreserved) issues.push({ severity: 'danger', title: 'Origin 被覆盖或缺失', detail: '删除 proxy_set_header Origin 配置，让浏览器 Origin 原样传递。' })
  else if (!diagnostics.trustedOriginMatched) issues.push({ severity: 'danger', title: 'Origin 未命中可信列表', detail: '把当前完整 Origin（含非默认端口）加入公开可信 Origin。' })
  if (!diagnostics.secureCookieTransport) issues.push({ severity: 'danger', title: 'HTTPS Cookie 与 HTTP 入口冲突', detail: '公开入口请启用 HTTPS；仅本机 HTTP 测试时才关闭「仅 HTTPS Cookie」。' })
  if (!status.credentialStoreWritable) issues.push({ severity: 'danger', title: 'Credentials 不可写', detail: '密码无法持久化；本地 Provider 请检查 .credentials.yaml 及其目录权限。' })
  return issues
}

function Field({ label, help, children }: { label: string; help?: string; children: JSX.Element }) {
  return <label className="dsh-access-gate-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>
}

function ToggleRow({ label, help, checked, disabled, compact = false, onChange }: {
  label: string
  help: string
  checked: boolean
  disabled: boolean
  compact?: boolean
  onChange(value: boolean): void
}) {
  return <div className={`dsh-access-gate-toggle-row${compact ? ' is-compact' : ''}`}>
    <span><strong>{label}</strong><small>{help}</small></span>
    <Switch ariaLabel={label} checked={checked} disabled={disabled} onChange={onChange} />
  </div>
}

function Switch({ ariaLabel, checked, disabled, onChange }: { ariaLabel: string; checked: boolean; disabled: boolean; onChange(value: boolean): void }) {
  return <label className="dsh-access-gate-switch"><input aria-label={ariaLabel} type="checkbox" checked={checked} disabled={disabled} onChange={event => { onChange(event.target.checked) }} /><span aria-hidden="true" /></label>
}

function decodeConfig(value: unknown): Config | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const item = value as Partial<Config>
  if (typeof item.enabled !== 'boolean' || (item.listenHost !== '127.0.0.1' && item.listenHost !== '0.0.0.0') || typeof item.listenPort !== 'number') return undefined
  return { ...defaultConfig(), ...item }
}

function defaultConfig(): Config {
  return {
    enabled: false,
    listenHost: '127.0.0.1',
    listenPort: 3081,
    secureCookies: true,
    publicOrigins: [],
    trustedProxyAddresses: [],
    machineBearerPrefixes: ['/knowledge-api/v1'],
    sessionTtlMinutes: 720,
    idleTimeoutMinutes: 60,
    maxFailedAttempts: 5,
    lockoutMinutes: 15,
    bindSessionToIp: false,
  }
}

function validateDraft(value: Config): string | undefined {
  if (!Number.isInteger(value.listenPort) || value.listenPort < 1 || value.listenPort > 65535) return '门禁端口必须是 1 到 65535 的整数。'
  if (value.listenHost === '0.0.0.0' && value.publicOrigins.length === 0) return '监听 0.0.0.0 时至少需要一个公开 Origin。'
  if (value.idleTimeoutMinutes > value.sessionTtlMinutes) return '空闲退出时间不能超过会话最长时限。'
  try {
    for (const origin of value.publicOrigins) {
      const url = new URL(origin)
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.pathname !== '/' || url.search || url.hash) throw new Error()
    }
    for (const prefix of value.machineBearerPrefixes) {
      if (!/^\/[A-Za-z0-9/_-]+$/u.test(prefix) || ['/api', '/plugins', '/assets'].includes(prefix.replace(/\/+$/u, ''))) throw new Error()
    }
  } catch { return '公开 Origin 或机器 API 前缀格式不正确。' }
  return undefined
}

function lines(value: string): string[] {
  return [...new Set(value.split(/\r?\n/u).map(item => item.trim()).filter(Boolean))]
}

async function adminRequest<T = unknown>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${ADMIN_PREFIX}/${path}`, {
    method,
    credentials: 'same-origin',
    ...(body === undefined ? {} : {
      headers: { 'content-type': 'application/json', 'x-dsh-access-action': '1' },
      body: JSON.stringify(body),
    }),
  })
  const value = await response.json().catch(() => ({})) as { error?: unknown }
  if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : `请求失败（HTTP ${response.status}）`)
  return value as T
}

async function diagnosticsRequest(): Promise<RequestDiagnostics> {
  const response = await fetch(DIAGNOSTICS_PATH, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-dsh-browser-origin': location.origin },
  })
  const value = await response.json().catch(() => ({})) as { error?: unknown }
  if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : `部署自检失败（HTTP ${response.status}）`)
  return value as RequestDiagnostics
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function installStyles(): () => void {
  document.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ID}"]`)?.remove()
  const style = document.createElement('style')
  style.dataset.plugin = PLUGIN_ID
  style.dataset.pluginCss = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
  return () => { style.remove() }
}
