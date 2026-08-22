# DSH Remote Settings Compatibility

为 DeepSeek Harness Web 提供可配置、可卸载的远程设置兼容层。只需维护一份 `trustedOrigins`，明确列出的浏览器 Origin 即可使用 DSH 原生设置、模型和凭证界面。

## 安装

### 从 GitHub Release 安装（推荐）

下载当前预发布包：

```bash
curl -fL \
  https://github.com/lemoncat7/dsh-remote-settings-compat/releases/download/v0.2.0-alpha.11/lemoncat7-dsh-remote-settings-compat-0.2.0-alpha.11.tgz \
  -o lemoncat7-dsh-remote-settings-compat-0.2.0-alpha.11.tgz
```

使用 DSH CLI 安装到 Web profile：

```bash
dsh plugin --profile web add \
  ./lemoncat7-dsh-remote-settings-compat-0.2.0-alpha.11.tgz
```

安装后重启 DSH，再通过本机地址进入 **Settings → Plugins → 远程设置兼容** 配置可信 Origin。

Docker Compose 部署可以先把安装包复制进正在运行的 DSH 服务，再调用相同的插件命令：

```bash
docker compose cp \
  ./lemoncat7-dsh-remote-settings-compat-0.2.0-alpha.11.tgz \
  dsh:/tmp/dsh-remote-settings-compat.tgz

docker compose exec dsh \
  dsh plugin --profile web add /tmp/dsh-remote-settings-compat.tgz

docker compose restart dsh
```

升级时先移除旧版本，再安装新的 `.tgz`：

```bash
dsh plugin --profile web remove @lemoncat7/dsh-remote-settings-compat
dsh plugin --profile web add ./lemoncat7-dsh-remote-settings-compat-0.2.0-alpha.11.tgz
```

卸载后重启 DSH 即可恢复官方行为。

## 配置

安装后可在 **Settings → Plugins → 远程设置兼容** 中维护可信地址。每行填写一个完整 Origin，保存后刷新页面生效。

首次启用时，远程浏览器还没有设置权限，需要先通过本机访问完成配置，或在 DSH profile / 启动 patch 中加入初始地址：

在 DSH profile patch 中配置完整 Origin：

```yaml
- id: remote-settings-compat
  config:
    trustedOrigins:
      - https://dsh.example.com:1443
```

Origin 必须包含协议、主机和实际端口，不支持通配符、路径、查询参数或用户凭证。

界面保存的值写入 DSH 官方 settings 文档，不会修改插件包或 DSH 官方文件。“恢复部署配置”会清除用户层覆盖，重新继承 profile 中的 `trustedOrigins`。

## 支持的远程接口

兼容层只开放设置界面实际需要的精确 RPC 路由：

- `settings.describe`
- `settings.update`
- `settings.replace`
- `settings.mutate`
- `credentials.describe`
- `credentials.set`
- `credentials.unset`
- `llm.discoverModels`

其他 `/api` 路由继续由 DSH 官方网关处理；插件不会开放任意文件路径接口。

## 工作方式

DSH 0.1.1 在非 loopback 页面将设置镜像固定为内存模式，同时限制旧版设置 RPC。本插件分为三个内部职责组件：

- Host：规范化 `trustedOrigins`，发布不可执行的 `<meta>` 元数据。
- Connection：复用官方 Connection，并合并 DSH 原有可信 Host 与插件白名单。
- RPC：只为上述八个旧版设置方法注册精确路由，业务仍委托给 DSH 官方 API 服务。

客户端只在 `location.origin` 精确命中时修正连接分类，然后继续使用官方设置服务。Host、Origin 和浏览器请求来源会在服务端再次校验；不接受通配符，也不信任缺少 Origin 的远程请求。

插件不修改 DSH 官方文件或 `node_modules`，不保存、记录或转发模型凭证。卸载插件并重启 DSH 后即可恢复官方行为。

## Docker 构建

```bash
docker build --output type=local,dest=dist .
```

构建会在 Node 24 镜像中运行测试，并在 `dist/` 生成可安装的 `.tgz` 包。

GitHub Release 中提供的安装包也是通过同一 Docker 构建流程生成。
