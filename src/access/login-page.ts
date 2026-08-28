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
    :root{color-scheme:light;font-family:Inter,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;background:#e8edf3;color:#252c35}
    *{box-sizing:border-box}
    ::selection{background:#dde7e5;color:#252c35}
    body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:#e8edf3}
    main{width:min(100%,390px);padding:30px;border:1px solid #cbd5d9;border-radius:18px;background:#f4f7fa;box-shadow:0 22px 60px rgba(37,44,53,.10)}
    header{display:grid;gap:7px;margin-bottom:24px}h1{margin:0;font-size:25px;font-weight:650;line-height:1.25;letter-spacing:-.02em}header p,.help{margin:0;color:#535f6c;font-size:13px;line-height:1.55}
    label{display:grid;gap:8px;color:#252c35;font-size:13px;font-weight:600}
    input,button{-webkit-appearance:none;appearance:none;font-family:inherit}
    input{width:100%;height:46px;margin:0;padding:0 13px;border:1px solid #95a7ab;border-radius:11px;background:#f8fafc;color:#252c35;font-size:14px;line-height:1;outline:none}
    input::placeholder{color:#8994a0;opacity:1}input:hover:not(:disabled){border-color:#5f6b78}input:focus-visible{border-color:#547d78;box-shadow:0 0 0 3px #dde7e5}input:disabled{background:#e8edf3;color:#8994a0;cursor:not-allowed;opacity:1}
    button{width:100%;height:46px;margin:16px 0 0;padding:0 16px;border:1px solid #547d78;border-radius:11px;background:#547d78;color:#fff;font-size:14px;font-weight:650;line-height:1;cursor:pointer;touch-action:manipulation;transition:background .15s,border-color .15s,transform .08s}
    button:hover:not(:disabled){border-color:#426a65;background:#426a65}button:active:not(:disabled){transform:translateY(1px)}button:focus-visible{outline:2px solid #547d78;outline-offset:3px}button:disabled{border-color:#a3bbb7;background:#a3bbb7;color:#fff;cursor:not-allowed;opacity:1}
    .error,.notice{margin:0 0 16px;padding:10px 12px;border:1px solid;border-radius:10px;font-size:12px;line-height:1.5}.error{border-color:#e3b9bd;color:#b44952;background:#f8e7e8}.notice{border-color:#dbc18e;color:#8a5b1c;background:#f3e8d2}
    .help{margin-top:18px;text-align:center;font-size:11px}
    @media(prefers-color-scheme:dark){:root{color-scheme:dark;background:#151c1e;color:#e3eaeb}::selection{background:#315357;color:#e3eaeb}body{background:#151c1e}main{border-color:#3c494b;background:#1f282a;box-shadow:0 22px 60px rgba(0,0,0,.32)}h1,label{color:#e3eaeb}header p,.help{color:#bbc9cc}input{border-color:#536163;background:#1d2527;color:#e3eaeb}input::placeholder{color:#899ca0}input:hover:not(:disabled){border-color:#687a7e}input:focus-visible{border-color:#69b6ba;box-shadow:0 0 0 3px #283335}input:disabled{background:#20292b;color:#95a7ab}button{border-color:#69b6ba;background:#69b6ba;color:#101719}button:hover:not(:disabled){border-color:#8aced0;background:#8aced0}button:focus-visible{outline-color:#8aced0}button:disabled{border-color:#47797d;background:#47797d;color:#cad5d7}.error{border-color:#74444a;color:#ff7d86;background:#3e2529}.notice{border-color:#665328;color:#e9bd68;background:#3a2d14}}
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
