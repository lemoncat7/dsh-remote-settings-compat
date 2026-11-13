# DSH Remote Access

DeepSeek Harness 的远程访问插件，将可信浏览器来源配置和独立密码网关放在一个设置入口中。

[![npm](https://img.shields.io/npm/v/%40lemoncat7%2Fdsh-remote-settings-compat)](https://www.npmjs.com/package/@lemoncat7/dsh-remote-settings-compat)

## 功能

- 显式配置可信 Origin，访问宿主模型、凭据和插件设置。
- 独立密码网关，透明代理 HTTP 与 WebSocket。
- 登录限速、会话过期、可选 IP 绑定与一键撤销会话。
- 机器 API 保留目标插件的 Bearer Token 校验；可单独开启只读知识库分享。
- DeepSeek 账号远程辅助登录：通过官方授权，手动粘贴本机回调地址，无需 SSH。

## 安装

需要 Node.js **>=24.9.0**。不按 DSH 版本号限制安装或加载；兼容性测试作为历史记录保留，见[宿主兼容策略](docs/host-compatibility-policy.md)。

```bash
dsh plugin --profile web add @lemoncat7/dsh-remote-settings-compat@latest
```

安装或升级后重启对应的 DSH Profile；`web` 请按实际使用的 Profile 调整。

安装后进入「设置 → 插件 → 远程访问」，配置完整 Origin 和密码网关。默认网关端口为 3081，DSH 原始端口为 3080；反向代理和端口边界按部署文档配置。

## 使用边界

可信 Origin 不等于密码保护。公开流量必须进入密码网关，原始 DSH 端口应收紧访问，避免绕过登录。生产环境使用 HTTPS；匿名分享默认关闭，启用后也只放行合法分享的只读路径，不放行搜索或管理接口。

## DeepSeek 账号远程辅助登录

DSH 0.2.1-rc.2 的官方账号登录仅接受本机 HTTP 回调地址，不能直接使用远程 HTTPS 域名。通过已登录的密码网关进入「设置 → 插件 → 远程访问」，使用「DeepSeek 账号 · 远程辅助登录」：

1. 点击「开始辅助登录」，再打开官方授权页面，完成账号验证。
2. 授权后会跳转到 `http://127.0.0.1:端口/oauth/callback?...`。本机页面可能打不开；复制浏览器地址栏中的**完整地址**即可，不需要在自己电脑上启动服务。
3. 回到原浏览器的远程访问设置，粘贴地址，点击「完成登录」，等待官方账号状态确认成功。

回调地址含一次性授权信息，勿分享或截图。输入提交后立即清空；插件不记录授权码，也不保存账号 token。插件只将回调参数交给固定的 DSH 本机回调接口，state、PKCE 校验及凭据保存仍由官方账号服务完成，不修改 DSH 核心，也不替换已有账号。

辅助登录绑定发起浏览器的 HttpOnly 会话 Cookie，最长十分钟，且受官方授权有效期限制。旧地址、其他浏览器的登录及重复提交会被拒绝；超时后先刷新登录状态，不要重复提交授权码。取消、过期或服务重启后需重新开始。官方服务网络异常、限流或账号验证失败不属于此适配可绕过的范围。

此入口要求宿主提供官方 `deepseekAccount` 服务；未加载时会显示接口不可用提示。它是远程访问设置里的独立辅助入口，不会替换官方「重新登录」按钮。

## 文档

- [部署、Nginx、迁移与配置](docs/usage.md)
- [版本与发布说明](https://github.com/lemoncat7/dsh-remote-settings-compat/releases)
- [发布维护约定](docs/releases/README.md)


## 宿主兼容策略

DSH 更新后不再为了补版本声明单独发布插件；按实际接口和功能验证、修复。[策略及历史测试入口](docs/host-compatibility-policy.md)。
