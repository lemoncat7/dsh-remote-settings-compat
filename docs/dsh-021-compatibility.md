# DSH 0.2.1-rc.2 兼容适配

本版本：0.6.4。宿主目标：DSH 0.2.1-rc.2；旧版 DSH 请继续使用原插件版本。

使用与宿主匹配的 Connection 运行时；移除修改 isLoopback 的旧远程设置补丁，使用原生持久化。网关转发时读取实际监听地址，支持延迟绑定端口；保留 Origin 白名单、密码门禁及登录失效提示。

浏览器端通过 DSH 的 client.inject 加载原生 Connection，不再内嵌和手动启动官方代码，避免新版 Node 条件导出误入网页及模块工厂重复注册。测试实际执行打包产物并确认仅注册插件自己的工厂。

沿用原生 connection 模块和配置入口，删除对已移除 webRuntime 服务的等待。注意：DSH patch 中的 name 是匹配保护条件，不是重命名；改为自定义模块名会被宿主跳过，导致配置的公网来源未加入连接白名单。现在通过原生条目的 trustedHosts 表达式合并 CLI 和插件来源，并用真实 DSH 配置合成器回归验证。可信来源改变时通过 Cordis 重新解析原生条目的完整配置（不写入替换配置），同时更新缓存的远程权限策略；变更可能触发一次自动重连。

所有 DSH 构建依赖固定为 0.2.1-rc.2，运行时 peerDependencies 与 engines.dsh 明确包含该预发布版本。不能仅根据声明判定兼容；升级前需在无生产凭据、无真实渠道的隔离容器验证。

本次不修改 DSH 核心源码，不迁移或清理生产会话与插件数据。

## 浏览器刷新补充修复

- 通过宿主 `tapIndex` 为同源 manifest 设置 `crossorigin="use-credentials"`，避免请求不带门禁 Cookie 而得到 HTML 登录页；不开放匿名 API、不修改外部 manifest。
- 网关仅为成功的哈希命名 JS/CSS 响应补充私有不可变缓存；不缓存 HTML、API、错误、重定向、带查询串或 Set-Cookie 的响应，不覆盖上游缓存策略。
- BFCache 恢复时调用原生 Connection 的 reconnect；普通聚焦和 pageshow 不重复重连，不建立第二套连接循环。
- 32 项测试通过，覆盖匹配边界、登录持久化、缓存限制及 pageshow 清理。
