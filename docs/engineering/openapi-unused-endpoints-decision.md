# OpenAPI 未使用接口处置清单

> 来源：`docs/engineering/openapi-coverage.md`（自动审计）
> 口径：仅统计前端是否调用，不代表后端是否实现。

## 决策规则

- 本轮收口：优先接入核心交易链路与风控/工单相关能力。
- P1 预留：平台内容 CMS 以外的扩展能力（如需继续后置）。
- P0 运维/工具：以运维脚本/监控系统使用为主，前端按需要选择性接入。

## 当前未使用列表（处置矩阵）

> 以 `docs/engineering/openapi-coverage.md` 的「关键差异」为基准；处理后需重跑审计并更新本表。
> 备注：AI 相关接口**本轮暂不接入**，需你明确指示后再推进。

| 接口 | 归属 | 处置 | 优先级 | 备注 |
| --- | --- | --- | --- | --- |
| GET /admin/ai/parse-results | 管理端 | 暂缓（待你确认） | P1 | AI 解析复核模块 |
| GET /admin/ai/parse-results/:param | 管理端 | 暂缓（待你确认） | P1 | AI 解析详情 |
| PATCH /admin/ai/parse-results/:param | 管理端 | 暂缓（待你确认） | P1 | AI 解析复核更新 |
| POST /ai/agent/query | 小程序 | 暂缓（待你确认） | P1 | 智能体语义检索 |
| POST /ai/parse-results/:param/feedback | 小程序 | 暂缓（待你确认） | P1 | AI 解析反馈 |

## 已处理（本轮）
- OpenAPI 覆盖审计修复：TS 泛型 `>>` 识别（maintenance/cases/rbac 等误报消除）。
- 接入：`GET/PUT /admin/config/alerts`（配置中心 JSON 编辑）。
- 接入：`POST /admin/orders/:param/invoice`（发票下发）。
- 接入：`PATCH /admin/rbac/roles/:param`（角色编辑）。
- 接入：`POST /admin/cases`（工单新建）。
- 接入：`GET /me/recommendations/listings`（首页推荐）。
- 接入：`GET /admin/patent-maintenance/schedules/:param`（编辑时补齐详情）。
- fixtures 补齐：maintenance schedules/tasks、rbac roles patch。
