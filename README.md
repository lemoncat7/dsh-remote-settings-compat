# DSH Remote Access

`@lemoncat7/dsh-remote-settings-compat` 是 DeepSeek Harness 的统一远程访问插件。它把可信远程设置和密码访问网关收敛到一个安装包、一个设置入口，同时保持各模块独立、可审计。

## 能力

- 允许显式可信的浏览器 Origin 使用 DSH 官方模型、凭证与插件设置。
- 提供独立密码网关：`3081 -> DSH 3080`，透明代理 HTTP 与 WebSocket。
- 密码使用 `scrypt` 不可逆保存；浏览器使用 HttpOnly、SameSite 会话 Cookie。
- 登录限速、会话过期、可选 IP 绑定与一键撤销全部会话。
- `/knowledge-api/v1` 等配置的机器 API 可继续使用 Bearer Token，Token 仍由目标插件验证。
- 不修改 DSH 主程序，也不接管 Knowledge、SSH 等业务路由。

## 内部结构

```text
remote-settings-compat     可信 Origin 与页面元数据
connection                 官方 Connection 兼容层
rpc                        最小化的远程设置 RPC 路由
access                     独立密码网关与管理 API
client                     统一的“远程访问”设置卡
```

模块通过 DSH/Cordis 官方 Bundle 与服务接口组合。空间、会话、Knowledge 和 SSH 插件不依赖本插件的内部实现。

## 升级兼容

从独立的 `@lemoncat7/dsh-access-gate` 升级时：

- 继续读取 `dsh-access-gate` 设置命名空间。
- 继续读取 Credentials 中原有的 `dsh-access-gate/password` 校验记录。
- 无需重设密码、公开 Origin 或会话策略。
- 新包生效后必须从 profile 移除旧 access-gate Bundle，避免两个网关同时监听同一端口。

## 部署

1. 在「设置 → 插件 → 远程访问」中填写完整公开 Origin，例如 `https://dsh.example.com:1443`。
2. 启用密码网关；Docker 部署通常监听 `0.0.0.0:3081`。
3. 保存后重启 DSH。
4. Nginx/1Panel 反代到 `3081`，并保留原始 Host 与端口：

```nginx
proxy_pass http://127.0.0.1:3081;
proxy_set_header Host $http_host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
```

原始 DSH 端口 `3080` 应只允许可信主机访问，否则可以绕过门禁。

## 开发

```bash
npm install
npm test
npm pack --dry-run
```
