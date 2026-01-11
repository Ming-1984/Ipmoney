# Mock 驱动并行开发（OpenAPI + fixtures）

> 目标：**前端不等后端接口**，页面/交互/状态机（loading/empty/error/权限）先做完；后端上线后只替换数据源。  
> 单一真相：`docs/api/openapi.yaml`（契约先行；任何接口改动先改 OpenAPI，再改前后端实现）。

## 1. 总体策略（最佳实践）

1) **接口契约锁定**：OpenAPI 作为唯一契约，CI 必跑 `npx -y @redocly/cli lint docs/api/openapi.yaml`。  
2) **两层 Mock**（建议同时具备）：
   - **契约 Mock（快速联调）**：基于 OpenAPI 直接启动 Mock Server。
   - **业务 Mock（可控演示/回归）**：基于 fixtures 的确定性数据，覆盖“难场景”。
3) **同一套 fixtures 三用**：开发调试 / 冒烟回归 / 甲方演示截图（避免一套数据写三遍）。

## 2. 契约 Mock（OpenAPI → Mock Server）

推荐工具：Prism（无需写后端即可起 Mock）。

- 启动 Mock Server：
  - `npx -y @stoplight/prism-cli mock docs/api/openapi.yaml --port 4010 --cors`
- 前端把 `API_BASE_URL` 指向 `http://127.0.0.1:4010`，即可用“契约 Mock”联调。

说明：
- Prism 默认按 schema 生成响应；若需要更贴近业务的响应，优先补充 OpenAPI 的 `example/examples`，或使用 fixtures（见下）。

## 3. 业务 Mock（fixtures：可控、可演示、可回归）

### 3.1 fixtures 目录建议

建议独立目录（后续落代码仓库时）：

```
packages/fixtures/
  scenarios/
    happy/
    empty/
    error/
    edge/
```

### 3.2 场景切换（推荐做法）

为覆盖“真实环境难构造”的情况，建议统一“场景开关”：

- Header：`X-Mock-Scenario: refund_failed` / `payment_callback_replay` / `empty_search` …
- 或 Query：`?__scenario=refund_failed`

前端骨架与演示时，只需切换场景即可展示：
- 退款失败/重试提示
- 回调重放导致的幂等提示
- 订单状态不允许跳转的错误提示
- 无数据/无权限/审核中等状态页

## 4. 难场景覆盖清单（P0 必做）

- **搜索/列表**：空结果、分页末页、过滤条件无效、排序枚举异常
- **详情**：404（下架/不存在）、敏感字段不可见（公开 vs 登录）
- **认证**：未选择身份、审核中、驳回（带原因）、通过后机构展示可见
- **订单状态机**：非法跳转（409/400）、并发提交（幂等键重复）
- **支付/退款**：回调重放、退款失败/处理中、重复支付提示
- **权限**：401（未登录）、403（无权限/RBAC）

## 5. 契约校验（防“Mock 漂移”）

每次改动都要确保：
- OpenAPI lint 通过（必做）
- fixtures（如有）结构与字段不缺失（建议做：用脚本校验 fixtures 是否满足 OpenAPI schema）

## 6. 回归与演示复用

建议把“演示骨架”纳入固定流程：
- 用同一套 fixtures 固定输出一组“可验收截图/录屏清单”
- 甲方演示：只切换场景，无需等后端、无需手工造数据

