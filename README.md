# DSH Remote Access

> 当前正式版 **0.6.1**，适配并验证 **DSH 0.1.7-rc.2**。插件为正式版，宿主仍为 RC；不支持直接用于旧宿主。Node.js **^22.19.0 或 >=24.0.0**。旧版源码保留于 `pre-dsh-0.1.7-rc.2`；详见 [0.6.1 发布说明](docs/releases/0.6.1.md)。

`@lemoncat7/dsh-remote-settings-compat` 是 DeepSeek Harness 的统一远程访问插件。它把可信远程设置和密码访问网关收敛到一个安装包、一个设置入口，同时保持各模块独立、可审计。

## 兼容性

正式版 `0.6.1` 针对 DeepSeek Harness `0.1.7-rc.2` 构建并完成部署验证，需要 Node.js `22.19+` 或 `24+`。插件直接使用该版本的 Connection、Credentials 与 Settings 服务接口。

## 能力

- 允许显式可信的浏览器 Origin 使用 DSH 官方模型、凭证与插件设置。
- 提供独立密码网关：`3081 -> DSH 3080`，透明代理 HTTP 与 WebSocket。
- 密码使用 `scrypt` 不可逆保存；浏览器使用 HttpOnly、SameSite 会话 Cookie。
- 登录限速、会话过期、可选 IP 绑定与一键撤销全部会话。
- `/knowledge-api/v1` 等配置的机器 API 可继续使用 Bearer Token，Token 仍由目标插件验证。
- 可显式开启 Knowledge 匿名分享：仅放行形如 `/knowledge-api/v1/shared/share_...` 的合法分享页、清单和内容 GET，不开放搜索、回写或管理接口。
- 不修改 DSH 主程序，也不接管 Knowledge、SSH 等业务路由。

## 内部结构

```text
remote-settings-compat     可信 Origin 与页面元数据
connection                 官方 Connection 兼容层
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

## 先区分两种能力

### `trustedOrigins`：远程设置权限

`remote-settings-compat.trustedOrigins` 允许指定的完整浏览器 Origin 使用 DSH 远程设置。它是唯一的 Origin 权威来源，同时供远程设置和密码门禁校验使用。

**只配置 `trustedOrigins` 不会启用 3081，也不会给 3080 加密码。**

### Access Gate：真正的密码门禁

Access Gate 在 3081 提供 HTTP/WebSocket 透明代理与密码会话。公开流量必须整体进入 3081，而原始 3080 必须从网络边界上收紧；否则任何人仍可绕过密码直连 DSH。

### Knowledge 匿名分享

在「设置 → 插件 → 远程访问 → Knowledge 与代理」开启「匿名读取 Knowledge 分享」后，未登录访客可以打开有效的笔记分享链接。该开关默认关闭，与 `machineBearerPrefixes` 相互独立：

- 只接受 `GET`，且 token 必须符合 Knowledge 分享格式。
- 只放行分享根页、`manifest` 和 `content` 子路径。
- `/knowledge-api/v1/search`、`notes`、`settings` 等其他路由仍需正常鉴权。
- `POST`/`PUT`/`PATCH`/`DELETE` 不会因该开关获得匿名权限。

## 推荐 Docker 部署

```yaml
services:
  dsh:
    ports:
      # 可删除；保留时只允许绑定宿主机回环地址
      - "127.0.0.1:3080:3080"

      # 密码网关。同机 Nginx 时也可绑定宿为 127.0.0.1
      - "127.0.0.1:3081:3081"
```

插件内部设置：

```yaml
dsh-access-gate:
  enabled: true
  listenHost: 0.0.0.0
  listenPort: 3081
  secureCookies: true

remote-settings-compat:
  trustedOrigins:
    - https://dsh.example.com:2439
```

`listenHost: 0.0.0.0` 是**容器内部**监听地址；`127.0.0.1:3081:3081` 是**宿主机**发布边界，两者不冲突。如果 Nginx 在另一台局域网主机上，3081 可按需绑定宿主机局域网 IP，但不应无防护地暴露到公网。

## 推荐 Nginx 反代

```nginx
location / {
    proxy_pass http://127.0.0.1:3081;

    # 必须保留非默认端口；不能用 $host
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Port $server_port;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $http_connection;
    proxy_http_version 1.1;
}
```

必须遵守三条边界：

1. 使用 `proxy_set_header Host $http_host;`，**不能使用 `$host`**。`$host` 会把 `dsh.example.com:2439` 变成 `dsh.example.com`，使精确 Origin/Authority 匹配失败。
2. **不要覆盖 Origin**。禁止配置 `proxy_set_header Origin http://127.0.0.1:3080;`，应让浏览器的 `Origin: https://dsh.example.com:2439` 原样传递。
3. **不要再单独把 `/api/` 代理到 3080**。页面、API 和 WebSocket 必须经过同一个 3081 入口。

## 首次启用流程

请按下列顺序分阶段切换，避免密码未初始化就改反代而把自己锁在外面：

1. 在「设置 → 插件 → 远程访问」填写完整的 `trustedOrigins`。
2. 启用网关，保存监听地址、端口和 Cookie 策略。
3. 使用本次 DSH 启动日志中的一次性初始化令牌设置密码。
4. 发布 3081，重启 DSH，并先确认 3081 能打开登录页。
5. 把反向代理从 3080 整体切到 3081。
6. 打开「部署自检」，确认 Host、Origin、当前入口和 Credentials 全部正常。
7. 最后删除 3080 的对外发布，或将它收紧到宿主机回环地址。

## 部署自检

「远程访问」卡片会同时从普通入口和真实 `/api/` 路径取样，检查：

- 浏览器 Origin 与服务端收到的 Origin。
- Host 是否保留非默认端口。
- 当前请求是否通过经 HMAC 签名的 Access Gate，而不是原始 3080。
- DSH upstream 是否监听在可能绕过门禁的地址。
- `secureCookies: true` 是否与 HTTP 公开地址冲突。
- Credentials Provider 是否可写。

插件无法从容器内绝对证明宿主机是否把 3080 发布到公网，因此对外发布边界仍应使用 `docker compose ps`、防火墙和外部连通性交叉确认。

## 1Panel 注意事项

- 备份文件不要放在站点实际加载的 proxy 目录中，避免被 include 两次。
- 保存后重新检查 `$http_host` 没有被面板改回 `$host`。
- 不要使用 1Panel 的自定义头把 Origin 改成 3080。
- 不要保留指向 3080 的独立 API location。
- 修改后先运行 `nginx -t`，再 reload；分别验证页面/API 响应和 WebSocket 升级。

## Credentials 权限

密码通过 DSH 官方 `ctx.credentials` 抽象存储，插件不假设所有 Provider 都是本地文件，也不会擅自 `chmod`。使用官方本地 Provider 时，密码校验记录通常位于 `$DSH_HOME/.credentials.yaml`，建议权限为 `600`：

```bash
stat -c '%a %U:%G %n' "$DSH_HOME/.credentials.yaml"
chmod 600 "$DSH_HOME/.credentials.yaml"
```

Docker/NAS 中如果自检显示 Credentials 不可写，请同时检查文件所有者、挂载是否只读，以及容器内 DSH 进程用户是否有权限访问父目录。

## 开发

```bash
npm install
npm test
npm pack --dry-run
```
