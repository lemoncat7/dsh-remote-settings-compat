# DSH Remote Access

DeepSeek Harness 的远程访问插件，将可信浏览器来源配置和独立密码网关放在一个设置入口中。

[![npm](https://img.shields.io/npm/v/%40lemoncat7%2Fdsh-remote-settings-compat)](https://www.npmjs.com/package/@lemoncat7/dsh-remote-settings-compat)

## 功能

- 显式配置可信 Origin，访问宿主模型、凭据和插件设置。
- 独立密码网关，透明代理 HTTP 与 WebSocket。
- 登录限速、会话过期、可选 IP 绑定与一键撤销会话。
- 机器 API 保留目标插件的 Bearer Token 校验；可单独开启只读知识库分享。

## 安装

适配 DeepSeek Harness **0.2.1-rc.2**（宿主仍为 RC），需要 Node.js **^22.19.0 或 >=24.0.0**。其他宿主版本请先查阅[兼容说明](docs/dsh-021-compatibility.md)和对应版本的发布说明。

```bash
dsh plugin --profile web add @lemoncat7/dsh-remote-settings-compat@latest
```

安装或升级后重启对应的 DSH Profile；`web` 请按实际使用的 Profile 调整。

安装后进入「设置 → 插件 → 远程访问」，配置完整 Origin 和密码网关。默认网关端口为 3081，DSH 原始端口为 3080；反向代理和端口边界按部署文档配置。

## 使用边界

可信 Origin 不等于密码保护。公开流量必须进入密码网关，原始 DSH 端口应收紧访问，避免绕过登录。生产环境使用 HTTPS；匿名分享默认关闭，启用后也只放行合法分享的只读路径，不放行搜索或管理接口。

## 文档

- [部署、Nginx、迁移与配置](docs/usage.md)
- [版本与发布说明](https://github.com/lemoncat7/dsh-remote-settings-compat/releases)
- [发布维护约定](docs/releases/README.md)
