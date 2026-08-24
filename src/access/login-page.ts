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
    :root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#eef1f0;color:#202624}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 15%,rgba(84,125,120,.11),transparent 38%),#eef1f0}
    main{width:min(100%,390px);padding:30px;border:1px solid rgba(35,48,43,.12);border-radius:18px;background:rgba(250,251,250,.94);box-shadow:0 22px 60px rgba(22,34,30,.10)}
    header{display:grid;gap:7px;margin-bottom:24px}h1{margin:0;font-size:25px;letter-spacing:-.02em}header p,.help{margin:0;color:#66716d;font-size:13px;line-height:1.55}
    label{display:grid;gap:8px;font-size:13px;font-weight:600}input{width:100%;height:46px;padding:0 13px;border:1px solid rgba(35,48,43,.18);border-radius:11px;background:#fff;color:#202624;font:inherit;outline:none}input:focus{border-color:#547d78;box-shadow:0 0 0 3px rgba(84,125,120,.12)}
    button{width:100%;height:46px;margin-top:16px;border:0;border-radius:11px;background:#466f69;color:#fff;font:650 14px/1 inherit;cursor:pointer}button:disabled{opacity:.42;cursor:not-allowed}
    .error,.notice{margin:0 0 16px;padding:10px 12px;border-radius:10px;font-size:12px;line-height:1.5}.error{color:#874440;background:#f7e9e7}.notice{color:#69572f;background:#f4efdf}
    .help{margin-top:18px;text-align:center;font-size:11px}
    @media(prefers-color-scheme:dark){:root,body{background:#111615;color:#edf2f0}body{background:radial-gradient(circle at 50% 15%,rgba(98,164,151,.12),transparent 38%),#111615}main{background:rgba(27,34,32,.96);border-color:rgba(225,235,231,.10);box-shadow:0 22px 60px rgba(0,0,0,.32)}header p,.help{color:#98a39f}input{background:#171d1b;color:#edf2f0;border-color:rgba(225,235,231,.16)}.error{color:#f1bbb5;background:#422724}.notice{color:#dbc98c;background:#383221}}
    @media(max-width:520px){body{padding:16px}main{padding:24px 20px;border-radius:15px}}
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
