# 技术选型（P0 默认）

> 原则：先用**模块化单体（按域分层）**快速交付 P0，并在代码结构与数据边界上保持“可拆分微服务”的演进路径（与 `docs/architecture/c4-container.mmd` 一致）。

## 客户端

- **微信小程序（买家/卖家）**：Taro（React + TypeScript）
  - 理由：工程化成熟、组件生态完善，可与用户 H5（Taro H5）复用一套代码与组件。
- **用户 H5（买家/卖家；电脑端可用）**：Taro H5（与小程序同构）
  - P0 策略：电脑端可浏览/咨询；**下单与支付引导回小程序**（二维码/链接）。
- **PC Web 管理后台（运营/客服/财务）**：React + TypeScript + Ant Design（或 Ant Design Pro）

- **UI 组件库（用户端）**：优先选成熟可复用方案降低成本（P0 推荐 NutUI Taro；备选 Taroify）
- **状态管理/请求（前端）**：Zustand + TanStack Query（统一 loading/error/cache；便于 Mock/真接口切换）
- **Mock 驱动并行开发**：基于 OpenAPI 的 Prism Mock + fixtures 场景（见 `docs/engineering/mocking.md`）
- **视觉规范**：橙色主题 +「专利点金台」理念（见 `docs/engineering/design-system.md`）

## 后端（API）

- **语言/框架**：Node.js LTS + NestJS + TypeScript
- **API 规范**：OpenAPI 3.0（见 `docs/api/openapi.yaml`）
- **鉴权**：JWT Bearer Token + RBAC（后台必须）
- **支付**：微信支付 v3（JSAPI 小程序支付；退款原路退）
- **放款（卖家收款）**：
  - **P0 默认：人工放款**（财务线下转账/企业网银等）+ 后台录入放款凭证（留痕对账）
  - P1：接入微信“商家转账/企业付款/分账”等自动放款能力（需资质与合规评估）

## 数据与基础设施

- **主库**：PostgreSQL 16
  - 理由：事务能力强；可用 FTS 做 P0 检索；后续可平滑接 ES/OpenSearch。
- **ORM/迁移**：Prisma（或 TypeORM；P0 推荐 Prisma 以提升研发效率）
- **缓存/队列**：Redis 7
  - 用途：限流、会话缓存、支付幂等键、异步任务队列（BullMQ）
- **检索**：
  - P0：PostgreSQL Full-Text Search（标题/摘要/主体名等）
  - P1：OpenSearch/Elasticsearch（大规模检索与复杂聚合）
- **对象存储**：
  - 本地/测试：MinIO（S3 兼容）
  - 生产：腾讯云 COS（或阿里 OSS；统一走 S3 兼容层）
- **图片/文件存放策略（小程序）**：
  - 本地包内仅保留 **UI 图标/占位图/引导页** 等“必须随包发布”的静态资源
  - 封面、头像、内容图、附件等“数量大/频繁更新”的资源统一走 **对象存储 + CDN**，客户端只持有 URL
  - **公开/私有分级**：公开资源直链；私有资源通过 **鉴权下载或短期签名 URL**
  - 建议目录规范：`/covers/YYYY/MM/`、`/avatars/{userId}/`、`/content/{entityId}/`、`/evidence/{entityId}/`
  - 变更策略：CDN 长缓存 + **文件名版本化**（避免线上更新不生效）

## 可观测性与安全（P0 最小集）

- **日志**：结构化日志（JSON），关键链路打 `traceId/requestId`
- **审计**：后台关键操作（审核/配置/退款/放款）必须审计日志
- **隐私**：证件号/银行账号等敏感字段加密存储；附件访问鉴权；必要时加水印

## 工程化（P0 默认）

- **Node.js**：20 LTS（建议用 Volta 或 `.nvmrc` 锁定）
- **包管理/Monorepo**：pnpm + Turborepo（便于共享类型、统一脚本、一键启动）
- **代码规范**：ESLint + Prettier；提交前校验（lint-staged + Husky）
- **OpenAPI 工具链**：
  - Redocly：lint/preview（`docs/api/openapi.yaml` 为唯一契约）
  - Prism：契约 Mock（并行开发）
  - （可选）openapi-typescript：生成前端类型/Client（减少字段漂移）
- **本地依赖**：docker-compose（Postgres/Redis/MinIO）
