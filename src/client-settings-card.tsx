import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import cssText from './client-settings-card.css'
import {
  decodeRemoteSettingsValue,
  formatTrustedOrigins,
  parseTrustedOriginsText,
  type RemoteSettingsValue,
} from './client-settings.js'
import { REMOTE_SETTINGS_NAMESPACE } from './shared.js'

const PLUGIN_ID = '@lemoncat7/dsh-remote-settings-compat'
const STYLE_ID = `${PLUGIN_ID}/settings-card`

interface SettingsSnapshot<T> {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | undefined
  writable: boolean
}

interface SettingsScope<T> {
  getSnapshot(): SettingsSnapshot<T>
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
  unset(field: string): Promise<void>
}

interface SlotService {
  inject(name: string, register: () => unknown): unknown
  register(options: Record<string, unknown>, component: () => JSX.Element): unknown
}

export interface RemoteSettingsUiContext {
  slots: SlotService
  settingsScope: {
    bind<T>(spec: { namespace: string; decode(value: unknown): T | undefined }): SettingsScope<T>
  }
  effect(setup: () => void | (() => void), label?: string): unknown
}

export function registerRemoteSettingsCard(ctx: RemoteSettingsUiContext): void {
  const scope = ctx.settingsScope.bind<RemoteSettingsValue>({
    namespace: REMOTE_SETTINGS_NAMESPACE,
    decode: decodeRemoteSettingsValue,
  })
  ctx.effect(installStyles, 'remote-settings-compat: settings card styles')
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: REMOTE_SETTINGS_NAMESPACE,
    id: REMOTE_SETTINGS_NAMESPACE,
    order: 35,
  }, () => <RemoteSettingsCard scope={scope} />))
}

function RemoteSettingsCard({ scope }: { scope: SettingsScope<RemoteSettingsValue> }) {
  const snapshot = useSyncExternalStore(
    listener => scope.subscribe(listener),
    () => scope.getSnapshot(),
  )
  const origins = snapshot.value?.trustedOrigins ?? []
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => formatTrustedOrigins(origins))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string }>()

  useEffect(() => {
    if (!dirty) setDraft(formatTrustedOrigins(origins))
  }, [dirty, origins])

  const parsed = useMemo(() => {
    try {
      return { value: parseTrustedOriginsText(draft) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [draft])

  const edit = (value: string): void => {
    setDraft(value)
    setDirty(true)
    setMessage(undefined)
  }
  const save = async (): Promise<void> => {
    if (!dirty || parsed.value === undefined || !snapshot.writable || saving) return
    setSaving(true)
    setMessage(undefined)
    try {
      await scope.set('trustedOrigins', parsed.value)
      setDirty(false)
      setMessage({ kind: 'success', text: '已保存。刷新页面后，新的可信地址规则会用于浏览器设置权限。' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }
  const restore = async (): Promise<void> => {
    if (!snapshot.writable || saving) return
    setSaving(true)
    setMessage(undefined)
    try {
      await scope.unset('trustedOrigins')
      setDirty(false)
      setMessage({ kind: 'success', text: '已恢复部署配置。刷新页面后生效。' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : String(error) })
    } finally {
      setSaving(false)
    }
  }

  const summary = snapshot.status === 'loading'
    ? '读取中'
    : snapshot.status === 'unavailable'
      ? '不可用'
      : `${origins.length} 个地址`

  return <li className="dsh-remote-settings-card">
    <button
      type="button"
      className="dsh-remote-settings-header"
      aria-expanded={open}
      onClick={() => { setOpen(value => !value) }}
    >
      <span className="dsh-remote-settings-heading">
        <strong>远程设置兼容</strong>
        <small>允许指定浏览器地址使用 DSH 官方模型与插件设置</small>
      </span>
      <span className="dsh-remote-settings-summary">{summary} · {open ? '收起' : '设置'}</span>
    </button>
    {open && <div className="dsh-remote-settings-body">
      {snapshot.status === 'unavailable'
        ? <p className="dsh-remote-settings-message" data-kind="error">当前浏览器没有设置写入权限。请先从本机访问，或在部署配置中加入当前完整 Origin。</p>
        : <>
          <label className="dsh-remote-settings-field" htmlFor="dsh-remote-settings-origins">
            可信浏览器地址
            <textarea
              id="dsh-remote-settings-origins"
              className="dsh-remote-settings-textarea"
              value={draft}
              disabled={snapshot.status !== 'ready' || !snapshot.writable || saving}
              placeholder="https://dsh.example.com:1443"
              spellCheck={false}
              onChange={event => { edit(event.target.value) }}
              aria-invalid={parsed.error !== undefined}
            />
          </label>
          <p className="dsh-remote-settings-help">每行一个完整 Origin，必须包含 http/https 协议和实际端口；不支持路径与通配符。留空表示仅保留 DSH 原有的本机访问规则。</p>
          {parsed.error !== undefined && <p className="dsh-remote-settings-message" data-kind="error">{parsed.error}</p>}
          {message !== undefined && <p className="dsh-remote-settings-message" data-kind={message.kind} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
          <div className="dsh-remote-settings-actions">
            <button type="button" disabled={!snapshot.writable || saving} onClick={() => { void restore() }}>恢复部署配置</button>
            <button type="button" className="is-primary" disabled={!dirty || parsed.value === undefined || !snapshot.writable || saving} onClick={() => { void save() }}>{saving ? '保存中…' : '保存'}</button>
          </div>
        </>}
    </div>}
  </li>
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
