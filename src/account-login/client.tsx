import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { LoginView } from './bridge.js'

const active = (phase?: string) => ['initializing', 'waiting-browser', 'exchanging', 'committing'].includes(phase ?? '')
const labels: Record<string, string> = {
  idle: '尚未开始', initializing: '正在准备授权', 'waiting-browser': '等待授权与回调地址',
  exchanging: '正在核验授权', committing: '正在保存凭据', succeeded: '登录成功',
  'signed-in': 'DSH 已保存账号凭据', cancelled: '已取消', expired: '登录已过期', failed: '登录未完成', busy: '其他窗口正在登录',
}

export function AccountLoginCard({ enabled }: { enabled: boolean }) {
  const [view, setView] = useState<LoginView>({ phase: 'idle' })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [address, setAddress] = useState('')
  const alive = useRef(true)
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const apply = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    setPending(true)
    setError('')
    try {
      const next = await accountRequest(action, body)
      if (alive.current) setView(next)
    } catch (e) {
      if (alive.current) {
        setError(e instanceof Error ? e.message : '请求未完成，请重试。')
        if (action === 'callback') input.current?.focus()
      }
    } finally { if (alive.current) setPending(false) }
  }, [])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  useEffect(() => {
    if (!enabled || pending) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      try {
        const next = await accountRequest('status', {}, controller.signal)
        if (!controller.signal.aborted) {
          setView(next)
          if (active(next.phase) || next.phase === 'busy') timer = setTimeout(() => { void refresh() }, 2000)
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '状态读取失败，请刷新登录状态。')
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [enabled, pending])

  const signedIn = view.phase === 'succeeded' || view.phase === 'signed-in'
  return <section className="dsh-account-login" aria-label="DeepSeek 远程辅助登录">
    <div className="dsh-access-gate-section-title"><span><strong>DeepSeek 账号 · 远程辅助登录</strong><small>不用 SSH；官方授权后，粘贴一次回调地址。不会读取或修改你的 API Key。</small></span></div>
    {!enabled ? <p className="dsh-access-gate-message">请通过已登录的密码门禁访问可信域名，再使用辅助登录。</p> : <>
      <p className="dsh-access-gate-message" role="status" aria-live="polite">{pending ? '正在处理…' : labels[view.phase] ?? '正在读取登录状态'}{view.expiresAt && active(view.phase) ? ` · 有效至 ${new Date(view.expiresAt).toLocaleTimeString()}` : ''}</p>
      {view.message && <p className="dsh-access-gate-message" data-kind="warning">{view.message}</p>}
      {error && <p id={`${inputId}-error`} className="dsh-access-gate-message" data-kind="error" role="alert">{error}</p>}
      {view.authorizeUrl && <div className="dsh-account-login-steps">
        <p>1. <a href={view.authorizeUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">打开官方授权页面</a>，完成账号登录。</p>
        <p>2. 授权后跳到 <code>{view.callbackOrigin}/oauth/callback</code>。该本机页面可能打不开，这是预期情况；请复制地址栏中的完整地址，回到这里粘贴。不要将地址发给别人。</p>
      </div>}
      {view.phase === 'waiting-browser' && <form onSubmit={event => {
        event.preventDefault()
        if (pending || !address.trim()) return
        const value = address
        setAddress('')
        void apply('callback', { attemptId: view.attemptId, address: value })
      }}>
        <label className="dsh-access-gate-field" htmlFor={inputId}><span>完整回调地址</span>
          <input ref={input} id={inputId} type="password" value={address} autoComplete="off" spellCheck={false}
            placeholder="粘贴包含 code 和 state 的完整地址" disabled={pending} required maxLength={8192}
            aria-describedby={error ? `${inputId}-error` : undefined} aria-invalid={!!error}
            onChange={event => { setAddress(event.target.value); setError('') }} />
        </label>
        <div className="dsh-access-gate-actions"><button type="submit" className="is-primary" disabled={pending || !address.trim()}>完成登录</button></div>
      </form>}
      <div className="dsh-access-gate-actions">
        {!active(view.phase) && !signedIn && view.phase !== 'busy' && <button type="button" className="is-primary" disabled={pending} onClick={() => { setAddress(''); void apply('start', { locale: navigator.language, timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 }) }}>开始辅助登录</button>}
        {active(view.phase) && view.attemptId && <button type="button" disabled={pending || view.phase === 'committing'} onClick={() => { setAddress(''); void apply('cancel', { attemptId: view.attemptId }) }}>取消本次登录</button>}
        <button type="button" disabled={pending} onClick={() => { void apply('status') }}>刷新登录状态</button>
      </div>
      {signedIn && <p className="dsh-access-gate-message" data-kind="success">账号凭据由 DSH 官方保存，可关闭设置继续使用。辅助登录不会退出已有账号。</p>}
    </>}
  </section>
}

async function accountRequest(action: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<LoginView> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 45000)
  try {
    const response = await fetch(`/remote-account-login/v1/${action}`, { method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { 'content-type': 'application/json', 'x-dsh-account-action': '1' }, body: JSON.stringify(body), signal: controller.signal })
    if (response.status === 404) throw new Error('当前服务未加载辅助登录接口，请确认插件版本和 DSH 账号服务。')
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('服务未返回登录状态，请确认门禁登录仍有效。')
    const result = await response.json() as LoginView & { error?: string }
    if (!response.ok) throw new Error(result.error ?? '登录操作未完成，请重试。')
    return result
  } catch (error) {
    if (controller.signal.aborted) throw new Error('请求已中断或超时，请刷新登录状态后再操作。')
    throw error
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
