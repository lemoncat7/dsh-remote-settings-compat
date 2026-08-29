import { randomBytes } from 'node:crypto'
import { loginVisualScript, loginVisualStyles } from './login-visual.js'

export function loginPage(options: { returnTo: string; csrfToken: string; error?: string; configured: boolean }): { html: string; nonce: string } {
  const nonce = randomBytes(18).toString('base64url')
  const returnTo = escapeAttribute(options.returnTo)
  const csrfToken = escapeAttribute(options.csrfToken)
  const hasError = options.error !== undefined
  const error = hasError ? `<p class="message error" id="password-error" role="alert">${escapeHtml(options.error ?? '')}</p>` : ''
  const unavailable = options.configured ? '' : '<p class="message notice" role="status">门禁密码尚未设置。请先从 DSH 插件设置中完成初始化。</p>'
  const disabled = options.configured ? '' : ' disabled'
  const invalid = hasError ? ' aria-invalid="true" aria-describedby="password-error"' : ''
  return {
    nonce,
    html: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>访问 DSH</title>
  <meta name="theme-color" content="#e7e8eb" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#111215" media="(prefers-color-scheme: dark)">
  <style nonce="${nonce}">${loginVisualStyles}</style>
</head>
<body>
  <div class="visual-scene" aria-hidden="true"><canvas class="ripple-distortion-canvas" data-ripple-distortion></canvas></div>
  <main class="access-layout">
    <section class="access-context" aria-label="DSH 远程访问">
      <div class="wordmark"><span class="wordmark-mark">DSH</span><span>REMOTE ACCESS</span></div>
      <p class="scene-kicker">PRIVATE WORKSPACE</p>
      <p class="scene-title">连接到你的 DSH 工作台</p>
      <p class="scene-copy">通过独立门禁进入远程工作环境。验证成功后，会话仅保存在当前浏览器。</p>
      <div class="security-notes" aria-label="访问保护"><span>独立密码门禁</span><span>浏览器会话隔离</span></div>
    </section>
    <section class="login-panel" aria-labelledby="login-title">
      <div class="panel-wordmark"><span class="wordmark-mark">DSH</span><span>REMOTE ACCESS</span></div>
      <header class="login-header">
        <p class="login-kicker">SECURE ACCESS</p>
        <h1 id="login-title">验证访问</h1>
        <p>输入 remote 门禁密码以继续进入工作台。</p>
      </header>
      ${error}${unavailable}
      <form method="post" action="/__dsh_access/login">
        <input type="hidden" name="returnTo" value="${returnTo}">
        <input type="hidden" name="csrfToken" value="${csrfToken}">
        <label class="password-label" for="access-password">访问密码</label>
        <div class="password-control">
          <input id="access-password" data-password-input name="password" type="password" autocomplete="current-password" minlength="6" maxlength="1024" placeholder="输入访问密码" required autofocus${invalid}${disabled}>
          <button class="password-toggle" data-password-toggle type="button" aria-label="显示密码" aria-pressed="false" aria-controls="access-password"${disabled}><span class="eye-glyph" aria-hidden="true"></span></button>
        </div>
        <button class="submit-button" type="submit"${disabled}>进入工作台</button>
      </form>
      <p class="help">多次验证失败将触发临时锁定</p>
    </section>
  </main>
  <script nonce="${nonce}">${loginVisualScript}</script>
</body>
</html>`,
  }
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}
