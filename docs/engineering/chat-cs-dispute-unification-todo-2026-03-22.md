# 聊天/客服/投诉统一改造 TODO（2026-03-22）

## 目标

- 小程序客服中心不再是一次性留言，改为持续会话入口。
- 订单投诉与退款流程接入同一会话链路，形成“会话 + 案件”协同处理。
- 管理后台会话工作台统一处理咨询/客服/争议三类会话。
- OpenAPI、类型、文档与实现保持一致。

## 任务清单

- [x] 后端会话域扩展：新增 `SUPPORT`、`DISPUTE` 会话类型。
- [x] 后端新增接口：
  - `POST /support/conversations`
  - `POST /orders/{orderId}/dispute-conversations`
- [x] 后端会话列表修复：`/me/conversations` 返回真实 `lastMessagePreview` 与 `unreadCount`。
- [x] 后端平台会话池扩展：`/admin/conversations/platform` 支持 `channel`（咨询/客服/争议）。
- [x] 后端分配能力统一：平台会话分配支持咨询/客服/争议。
- [x] 小程序客服中心改造：在线客服会话主入口 + 反馈直接写入会话。
- [x] 小程序订单详情改造：新增“争议沟通”入口直达聊天。
- [x] 小程序消息列表改造：不再过滤掉客服/争议会话。
- [x] 管理后台会话页改造：新增会话类型筛选与会话类型标识。
- [x] OpenAPI 更新：新增接口、新增枚举值、平台会话查询参数更新。
- [x] 文档更新：API README 与本 TODO 同步。

## 验证

- [x] `pnpm -C apps/api test`
- [x] `pnpm -C apps/api typecheck`
- [x] `pnpm -C apps/admin-web typecheck`
- [x] `pnpm -C apps/client typecheck`
- [x] `pnpm openapi:lint`
- [x] `pnpm openapi:types`
