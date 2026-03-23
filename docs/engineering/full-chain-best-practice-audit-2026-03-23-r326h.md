# 全链路最佳实践审计（2026-03-23 / r326h）

## 范围

- 小程序（`apps/client`）：核心页面、路由加载、聊天/客服/争议/年费托管链路入口
- 管理后台（`apps/admin-web`）：全量页面渲染与 DOM 语义冒烟
- 后端（`apps/api`）：单元测试、e2e、契约与质量门禁

## 自动化执行结果

- `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1 -ReportDate r326i -UiSmokeMode full -RunWeappRouteSmoke -WeappCliPath "D:\微信web开发者工具\cli.bat" -WeappUserToken <demo-token>`
  - 结果：通过（聚合门禁）
  - 关键指标：`api-real-smoke 1304/1304`、`ui-render(full) 64/64`、`ui-dom(full) 64/64`、WeApp 路由 `noauth 12/12` + `auth 12/12`

- `powershell -ExecutionPolicy Bypass -File scripts/ui-render-smoke.ps1 -Mode full -ReportDate r326h`
  - 结果：`64/64` 通过
- `powershell -ExecutionPolicy Bypass -File scripts/ui-dom-smoke.ps1 -Mode full -ReportDate r326h`
  - 结果：`64/64` 通过
- `powershell -ExecutionPolicy Bypass -File scripts/weapp-route-smoke.ps1 -ReportDate r326h-auth -UserToken <demo-token> -KillStaleDevtools`
  - 结果：通过（`12/12` 路由）
- `powershell -ExecutionPolicy Bypass -File scripts/weapp-route-smoke.ps1 -NoAuth -ReportDate r326h-noauth-rerun -LaunchRetries 3 -KillStaleDevtools`
  - 结果：通过（`12/12` 路由）
  - 说明：首次 `r326h-noauth` 因 DevTools 端口占用启动失败，重跑通过（环境抖动，不属于业务逻辑失败）
- `pnpm -C apps/api test`
  - 结果：`550/550` 通过
- `pnpm -C apps/api test:e2e`
  - 结果：`2/2` 通过

## 代码与流程完善（本轮已落地）

- `scripts/verify.ps1`
  - 新增 `-UiSmokeMode core|full`，支持按阶段切换核心/全量 UI 冒烟
  - 新增 `-RunWeappRouteSmoke`，可在门禁中执行小程序路由冒烟（无登录 + 登录态）
- `docs/api/openapi.yaml`
  - `servers[0].url` 统一为 `https://api.ipmoney.cn`，与当前生产域名口径一致
- `docs/engineering/system-test-plan.md`
  - 增加“全链路自动化推荐命令”与执行策略（标准门禁/深度门禁）

## 与最佳实践的对齐结论

- 已对齐：
  - 分层门禁（快速核心门禁 + 深度全链路门禁）
  - 客服/咨询/争议采用持续会话模型，后台统一会话池运营
  - 微信支付回调保留原始请求体校验路径（Nest raw body 能力）
  - API 具备质量底线门禁（覆盖率、状态码结构、负向场景比例）
- 继续建议（下一轮）：
  - 在 staging 固化 `-UiSmokeMode full -RunWeappRouteSmoke` 的定时任务（每日/每次发布前）
  - 在生产观测中补齐“会话首响时延、会话积压量、年费工单超时率”三类业务 SLI

## 参考（联网调研）

- NestJS Validation（输入校验基线）  
  https://docs.nestjs.com/techniques/validation
- NestJS Raw Body（Webhook/支付回调验签前提）  
  https://docs.nestjs.com/faq/raw-body
- 微信支付 APIv3 回调与查单指引（官方）  
  https://pay.wechatpay.cn/doc/v3/merchant/4012075249
- 微信支付文档（商户平台）  
  https://pay.wechatpay.cn/doc/v3/merchant/4012365342
- Taro 小程序分包/优化实践  
  https://docs.taro.zone/docs/optimized
- Zendesk Omnichannel Routing（会话统一运营思路参考）  
  https://support.zendesk.com/hc/en-us/articles/4409149119514-About-omnichannel-routing
- OWASP API Security（API 风险基线）  
  https://owasp.org/www-project-api-security/
