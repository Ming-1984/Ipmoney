# 管理后台运营与会话工作台重构 TODO（2026-03-22）

## 重构原则

- 不做兼容与兜底，直接按最新需求重构。
- 列表筛选、分页、查询参数全部以后端为准，不做前端二次主过滤。
- 会话链路统一为“持续会话”，不再保留一次性留言式客服入口。
- OpenAPI、前后端实现、共享类型、文档同步更新并通过校验。

## 联网调研结论（最佳实践依据）

- 会话分配应支持“负载均衡/轮询/最长未分配”等策略，并结合坐席容量与在线状态：
  - Zendesk Omnichannel Routing：
    - https://support.zendesk.com/hc/en-us/articles/4409149119514-About-omnichannel-routing
    - https://support.zendesk.com/hc/en-us/articles/4828787357210-Managing-your-omnichannel-routing-configuration
  - Intercom Balanced Assignment：
    - https://www.intercom.com/help/en/articles/6553774-balanced-assignment-deep-dive
- 消息历史拉取建议使用 cursor 分页，适配连续会话与增量加载：
  - Slack Web API Pagination：
    - https://docs.slack.dev/apis/web-api/pagination/
- 关键写操作（发消息、分配、建会话）建议全量幂等：
  - Stripe Idempotent Requests：
    - https://docs.stripe.com/api/idempotent_requests

## 范围与任务

### A. 管理后台会话工作台（`PlatformConversationsPage`）

- [x] 从损坏文件重建为 UTF-8 可维护版本。
- [x] 双栏收件箱布局：左侧会话列表 + 右侧连续对话。
- [x] 统一筛选：`q`、`assigned`、`channel`、`listingTopic`、`updatedFrom/updatedTo`。
- [x] 统一会话类型：咨询（`LISTING`）/ 客服（`SUPPORT`）/ 争议（`DISPUTE`）。
- [x] 历史消息 cursor 分页（加载更早消息）。
- [x] 坐席分配改为员工下拉选择，支持“分配给我 / 指定分配 / 移除”。
- [x] 自动刷新开关与手动刷新入口。
- [x] 明确消息发送人（用户/我/其他坐席）。

### B. 小程序聊天页（`subpackages/messages/chat/index.tsx`）

- [x] 从损坏文件重建为 UTF-8 可维护版本。
- [x] 保持连续会话体验：轮询、上拉历史、失败重试、已读标记。
- [x] `SUPPORT` 与 `DISPUTE` 会话显示名统一。
- [x] 争议会话上下文支持跳转订单详情。
- [x] 客服会话与咨询会话统一在同一聊天容器处理。

### C. 客服中心与投诉入口统一

- [x] `POST /support/conversations`：客服中心进入持续会话。
- [x] 反馈提交直接写入会话消息，不再只有一次性表单记录。
- [x] 订单详情“争议沟通”接 `POST /orders/{orderId}/dispute-conversations`。

### D. OpenAPI、类型与文档统一

- [x] `docs/api/openapi.yaml` 同步新增与扩展：
  - `POST /support/conversations`
  - `POST /orders/{orderId}/dispute-conversations`
  - `GET /admin/conversations/platform` 新增 `channel` 等筛选参数
  - `ConversationContentType` 增加 `SUPPORT`、`DISPUTE`
- [x] `pnpm openapi:types` 生成并同步 `packages/api-types/index.d.ts`。
- [x] `docs/api/README.md` 同步统一会话与筛选规范。
- [x] `docs/engineering/chat-cs-dispute-unification-todo-2026-03-22.md` 完成状态回填。

## 验证与质量门禁

- [x] `pnpm -C apps/api test`
- [x] `pnpm -C apps/api typecheck`
- [x] `pnpm -C apps/api lint`
- [x] `pnpm -C apps/admin-web typecheck`
- [x] `pnpm -C apps/admin-web lint`
- [x] `pnpm -C apps/client typecheck`
- [x] `pnpm -C apps/client lint`
- [x] `pnpm openapi:lint`
- [x] `pnpm openapi:types`

## 当前结论

- 聊天、客服、投诉三条链路已统一为持续会话模型。
- 管理后台已具备统一管理与批量运营场景下的会话处理能力（筛选、分配、追溯、连续沟通）。
- 文档、OpenAPI、共享类型已同步并通过静态校验与关键测试。
