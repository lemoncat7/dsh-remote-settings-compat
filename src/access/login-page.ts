import { randomBytes } from 'node:crypto'

export function loginPage(options: { returnTo: string; csrfToken: string; error?: string; configured: boolean }): { html: string; nonce: string } {
  const nonce = randomBytes(18).toString('base64url')
  const returnTo = escapeAttribute(options.returnTo)
  const csrfToken = escapeAttribute(options.csrfToken)
  const error = options.error === undefined ? '' : `<p class="error" role="alert">${escapeHtml(options.error)}</p>`
  const unavailable = options.configured ? '' : '<p class="notice">门禁密码尚未设置。请先从 DSH 插件设置中完成初始化。</p>'
  const disabled = options.configured ? '' : ' disabled'
  return {
    nonce,
    html: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>访问 DSH</title>
  <style nonce="${nonce}">
    :root{color-scheme:light;font-family:Inter,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;background:#eef2f0;color:#202825}
    *{box-sizing:border-box}
    ::selection{background:#cfe4de;color:#173a34}
    body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:#eef2f0}
    main{width:min(100%,390px);padding:30px;border:1px solid #d8dfdc;border-radius:18px;background:#fafbfa;box-shadow:0 22px 60px rgba(22,34,30,.10)}
    header{display:grid;gap:7px;margin-bottom:24px}h1{margin:0;font-size:25px;font-weight:650;line-height:1.25;letter-spacing:-.02em}header p,.help{margin:0;color:#596760;font-size:13px;line-height:1.55}
    label{display:grid;gap:8px;color:#202825;font-size:13px;font-weight:600}
    input,button{-webkit-appearance:none;appearance:none;font-family:inherit}
    input{width:100%;height:46px;margin:0;padding:0 13px;border:1px solid #9eada7;border-radius:11px;background:#fff;color:#202825;font-size:14px;line-height:1;outline:none}
    input::placeholder{color:#7a8681;opacity:1}input:hover:not(:disabled){border-color:#6f817a}input:focus-visible{border-color:#356f66;box-shadow:0 0 0 3px #dbeae6}input:disabled{background:#eef2f0;color:#76827d;cursor:not-allowed;opacity:1}
    button{width:100%;height:46px;margin:16px 0 0;padding:0 16px;border:1px solid #356f66;border-radius:11px;background:#356f66;color:#fff;font-size:14px;font-weight:650;line-height:1;cursor:pointer;touch-action:manipulation;transition:background .15s,border-color .15s,transform .08s}
    button:hover:not(:disabled){border-color:#285e56;background:#285e56}button:active:not(:disabled){transform:translateY(1px)}button:focus-visible{outline:2px solid #17665a;outline-offset:3px}button:disabled{border-color:#aeb9b5;background:#aeb9b5;color:#f7f9f8;cursor:not-allowed;opacity:1}
    .error,.notice{margin:0 0 16px;padding:10px 12px;border:1px solid;border-radius:10px;font-size:12px;line-height:1.5}.error{border-color:#edc5c0;color:#874440;background:#fff1ef}.notice{border-color:#e5cf9f;color:#69572f;background:#fff7e7}
    .help{margin-top:18px;text-align:center;font-size:11px}
    @media(prefers-color-scheme:dark){:root{color-scheme:dark;background:#111614;color:#edf2f0}::selection{background:#315c54;color:#f3f8f6}body{background:#111614}main{border-color:#394541;background:#1b2220;box-shadow:0 22px 60px rgba(0,0,0,.32)}h1,label{color:#edf2f0}header p,.help{color:#aab6b1}input{border-color:#66756f;background:#202825;color:#edf2f0}input::placeholder{color:#89958f}input:hover:not(:disabled){border-color:#83928c}input:focus-visible{border-color:#6da99e;box-shadow:0 0 0 3px #294f48}input:disabled{background:#28312e;color:#9eaaa5}button{border-color:#6da99e;background:#6da99e;color:#10211d}button:hover:not(:disabled){border-color:#82b9af;background:#82b9af}button:focus-visible{outline-color:#8ac8bd}button:disabled{border-color:#58655f;background:#58655f;color:#cbd4d1}.error{border-color:#68413e;color:#ef9b93;background:#372624}.notice{border-color:#66552e;color:#e3c378;background:#342f22}}
    @media(max-width:520px){body{padding:16px}main{padding:24px 20px;border-radius:15px}}
    @media(prefers-reduced-motion:reduce){button{transition:none}}
  </style>
</head>
<body>
  <main>
    <header><h1>访问 DSH</h1><p>此工作台受到密码保护。登录会话只保存在当前浏览器中。</p></header>
    ${error}${unavailable}
    <form method="post" action="/__dsh_access/login">
      <input type="hidden" name="returnTo" value="${returnTo}">
      <input type="hidden" name="csrfToken" value="${csrfToken}">
      <label>访问密码<input name="password" type="password" autocomplete="current-password" minlength="6" maxlength="1024" required autofocus${disabled}></label>
      <button type="submit"${disabled}>登录</button>
    </form>
    <p class="help">多次失败将触发临时锁定。</p>
  </main>
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
