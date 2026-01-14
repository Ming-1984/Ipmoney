# 执行 Playbook：Mock 先行、前后端并行、后端逐模块替换

> 单一真相：`docs/api/openapi.yaml`。任何接口调整先改 OpenAPI，再改 fixtures/前端/后端实现。

## 1) P0 推荐节奏（最省时间）

1. **改 OpenAPI**：补字段/枚举/错误码/分页规则，并 `pnpm openapi:lint`。
2. **补 fixtures**：在 `packages/fixtures/scenarios/*/index.json` 写 happy/empty/error/edge/难场景响应。
3. **前端先落 UI**：按 OpenAPI 走 Mock，把页面/交互/状态机（loading/empty/error/权限/审核态）一次性做完。
4. **后端再替换数据源**：按模块把接口逐个做成真实实现；同一契约下前端无需改交互逻辑。

## 2) 本地启动（演示/联调）

- 一键（Mock + Client H5 + Admin Web）：`scripts/demo.ps1`
- 仅 Mock：`pnpm mock`（`http://127.0.0.1:4010`）
- OpenAPI 预览（可选）：`pnpm openapi:preview`（`http://127.0.0.1:8080`）

场景切换：
- Header：`X-Mock-Scenario: happy|empty|error|edge|payment_callback_replay|order_conflict|refund_failed`
- 或 Query：`?__scenario=happy`（便于浏览器调试）

## 3) 后端“逐模块替换”两种方式

### 方式 A：全切到真实 API（简单）

当后端已覆盖某一批页面所需接口时：
- 把前端 `TARO_APP_API_BASE_URL` / `VITE_API_BASE_URL` 改为真实 API Base URL
- 前端只替换数据源，不改页面交互逻辑

### 方式 B：mock-api 做“开发网关”（推荐：平滑替换）

让前端始终请求 `mock-api(4010)`，由 mock-api 选择把哪些路由转发到真实 API，其余仍走 fixtures/Prism：
- 优点：后端没做完也不影响演示/开发；可以按模块开关替换
- 做法：设置 `UPSTREAM_API_BASE_URL` + `UPSTREAM_PATH_PREFIXES`（见 `apps/mock-api/src/server.js` 说明）

建议替换顺序（P0）：
1) `Files`（上传/证据/发票依赖）→ 2) `Patents/normalize` → 3) `Listings + Search` → 4) `Messaging` → 5) `Orders/Payments/Refunds/Settlement`

