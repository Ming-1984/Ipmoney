# Ipmoney（专利交易平台）TODO（先文档定稿，再开工）

> 目标：支持 **微信小程序 + 用户 H5（电脑端可用） + PC Web 管理后台**；在正式开发前，先把 PRD / 架构图 / 业务流程图 / ER / OpenAPI 做到“可签字、可联调、可交付演示”。

## 0. 里程碑与验收口径

- [ ] **M0：文档签字版（对甲方演示用）**（文档已齐，待甲方确认/签字）
  - [x] PRD 无“待确认”项（均转为 P0 默认值或明确标注 P1）
  - [x] C4（Context/Container/Component）+ 关键时序图 + ER 图 + 业务流程图（BPMN/Flowchart）齐全且一致
  - [x] OpenAPI 覆盖 P0 主链路且字段/枚举与 ER/状态机一致
  - [x] **演示级图表包**：业务泳道逻辑图 + P0/目标架构 + 部署图 + 资金/数据流安全边界（代码生成，可导出 PNG/PDF）
- [ ] **M0.5：前端骨架演示（Mock 驱动，不等后端）**
  - [ ] 用户端（小程序 + H5）：页面骨架 + 交互/状态机（loading/empty/error/权限/审核中/不可操作原因提示）完成
  - [ ] 后台（Admin Web）：关键页面骨架完成（认证审核/上架审核/订单/退款/放款/发票/地图 CMS）
  - [ ] OpenAPI Mock 可运行：可切换“正常/失败/重放/无数据”等场景；fixtures 可复用做截图与演示
  - [ ] 视觉规范落地：主色橙色（寓意成功），「专利变金豆矿」视觉点缀（见 `docs/engineering/design-system.md`）
- [ ] **M1：可联调 API Mock / 服务骨架**
- [ ] **M2：P0 主链路可跑通（订金→合同确认→尾款→变更完成→结算放款）**
- [ ] **M3：上线前合规/风控/对账齐套**

## 1. 范围与渠道确认（先定清“电脑网页”是哪个）

- [x] 确认“电脑网页”范围（写入 PRD）：
  - [x] **管理后台（PC Web）**（P0）
  - [x] **用户 H5（买家/卖家；电脑端可用）**（P0，Taro H5）
    - [x] P0 不做电脑端支付：电脑端仅浏览+咨询；下单/支付引导回小程序（二维码/链接）
  - [ ] （可选）**独立用户 PC Web（非 H5）**（P1，若后续需要更强桌面体验）
- [x] 确认 P0 客户端交付：
  - [x] 微信小程序（买家/卖家）
  - [x] 用户 H5（电脑端可用，Taro H5）
  - [x] PC Web 后台（运营/客服/财务）

## 2. PRD（Ipmoney.md）核对与补齐

文件：`Ipmoney.md`

- [x] 核对“业务规则”是否全部可落库/可执行：
  - [x] 订金计算、自动退款窗口、人工审核条件（7.1）
  - [x] 合同签署确认解锁尾款（7.2）
  - [x] 放款条件（P0 默认：必须变更完成确认；超时自动放款关闭）
  - [x] 多卖家同专利上架：前台展示、后台审核、举报处置（7.4）
- [x] 补齐“异常/边界场景”清单（对账/争议/退款并发/重复支付/回调重放）
- [x] 补齐“权限矩阵”到可实现粒度（后台 RBAC：运营/客服/财务/管理员）
- [x] 补齐“合规提示文案与用户协议清单”（展示用 + 未来法务版占位）
- [x] 补齐“发票与税务说明”与开票规则（订单完成后财务线下开票并上传电子发票，平台内下载）：`docs/legal/invoice-tax.md`

## 3. 数据模型（ER）与落库设计

文件：`docs/architecture/er-diagram.mmd`

- [x] 逐表核对字段与 PRD/OpenAPI 一致：
  - [x] `orders.deal_amount / deposit_amount / final_amount / commission_amount`
  - [x] `refund_requests.status` 是否含 `REFUNDING`
- [x] 补齐“系统配置表”（承载 8.4 的可配置项）
  - [x] `system_configs`（key/value/类型/生效范围/版本/审计）
- [x] 补齐“审计/风控/证据链”最小表（用于争议/退款/审核留痕）
  - [x] 操作日志（who/what/when/before/after）
- [x] 输出 P0 目标数据库选型与索引策略（Postgres/MySQL 其一）

## 4. OpenAPI 覆盖度与一致性审计

文件：`docs/api/openapi.yaml`

- [x] 覆盖 P0 主链路的端到端接口：
  - [x] Listing：创建/编辑/提交审核/下架
  - [x] Admin：上架审核通过/驳回
  - [x] Order：创建订单、查看订单、列表
  - [x] Payment：订金/尾款支付意图、回调入口
  - [x] Milestone：合同签署确认（写入 `dealAmountFen` 并解锁尾款）、变更完成确认（触发结算）
  - [x] Settlement：查看结算台账、财务人工放款确认（P0 默认）
  - [x] Refund：买家发起退款、后台审批、微信退款回调
  - [x] Invoices：订单完成后财务上传/替换电子发票（平台内下载）
- [x] 补齐“认证审核”闭环接口（后台 approve/reject）
- [x] 补齐“系统配置读取/修改”接口（前台展示订金/佣金/退款规则；后台配置）
- [x] 统一命名与币种单位：
  - [x] 金额统一 `*_Fen`（分），时间统一 ISO8601
  - [x] 状态枚举与 PRD/时序/ER 完全一致
- [x] 增加幂等与对账字段规范（支付/退款/放款）：
  - [x] `Idempotency-Key`（建议）与回调验签 Header（Wechatpay-*）说明（占位）

## 5. 架构图与业务流程图（给甲方演示用）

现有文件：
- `docs/architecture/c4-context.mmd`
- `docs/architecture/c4-container.mmd`
- `docs/architecture/c4-component-order.mmd`
- `docs/architecture/sequence-deposit-payment.mmd`
- `docs/architecture/sequence-refund.mmd`
- `docs/architecture/sequence-settlement.mmd`

需补齐/优化：
- [x] C4-Container：把“P0 不接外部数据源”明确标注（P1 可选适配层）
- [x] 增加 **业务流程图**（建议新增文件，便于演示）：
  - [x] `docs/architecture/flow-listing-publish.mmd`（发布→审核→上架）
  - [x] `docs/architecture/flow-trade-end2end.mmd`（搜索→订金→跟单→合同→尾款→变更→结算）
  - [x] `docs/architecture/state-order.mmd`（订单状态机）
  - [x] `docs/architecture/flow-refund-dispute.mmd`（退款/争议工单）
- [x] 如甲方需要“微服务可拆分”说明：补一页拆分策略（按域/按流量/按合规）

演示增强（更“高端/可讲故事”，仍保持与工程一致）：
- [x] 业务主链路泳道逻辑图（含关键决策/超时/可退不可退分支）：`docs/demo/diagrams/business-core-swimlane.mmd`
- [x] 退款/争议泳道逻辑图（自动秒退/人工审核/证据/对账）：`docs/demo/diagrams/business-refund-dispute-swimlane.mmd`
- [x] P0 逻辑架构（模块化单体，可拆分微服务）：`docs/demo/diagrams/architecture-p0-logical.mmd`
- [x] 目标微服务架构（长期演进）：`docs/demo/diagrams/architecture-target-microservices.mmd`
- [x] 生产部署图（云上典型）：`docs/demo/diagrams/deployment-prod.mmd`
- [x] 资金流/数据流与安全边界图（PII/证据/支付回调/审计）：`docs/demo/diagrams/dataflow-money-pii-security.mmd`
- [x] 事件模型与异步任务图（Outbox/重试/幂等/对账）：`docs/demo/diagrams/event-model.mmd`

## 6. 技术工程选型（写成可执行配置）

新增文件（建议）：
- [x] `docs/engineering/tech-stack.md`（选型与理由：后端/DB/缓存/搜索/对象存储/消息队列/支付/部署）
- [x] `docs/engineering/environments.md`（dev/test/prod 环境变量清单与密钥管理）
- [x] `docs/engineering/repo-structure.md`（代码组织：模块化单体→可拆分微服务）
- [x] `docs/engineering/mocking.md`（OpenAPI 驱动 Mock + fixtures：前后端并行、难场景覆盖、演示复用）
- [x] `docs/engineering/design-system.md`（前端橙色主题 + 金豆矿理念：组件/状态/文案规范）

必须定稿项：
- [x] 后端语言/框架（Node.js + NestJS + TypeScript）
- [x] 数据库（PostgreSQL）与 ORM/迁移方案（P0：Prisma）
- [x] 小程序技术栈（Taro + React + TypeScript）
- [x] PC Web 技术栈（React + TypeScript + Ant Design）
- [x] 用户 H5（Taro H5，同构复用；P0 不做 H5 支付）
- [x] 微信支付能力路径：
  - [x] 订金/尾款（JSAPI 小程序）
  - [x] 退款（原路退）
  - [x] 放款（P0：财务人工放款回传凭证；P1 再评估企业付款/分账等自动化能力）

## 7. 正式执行（开发）任务拆解（在文档签字后启动）

> 目标：以 **最低开发成本** 跑通 P0 主链路（订金→合同确认→尾款→变更完成→结算放款→发票上传下载），并确保“可拆分微服务”的演进路径（但 P0 先模块化单体）。

### 7.1 仓库与工程化（M1）

- [ ] 初始化 Monorepo（建议 pnpm workspace）：`apps/api` + `apps/admin-web` + `apps/client`（Taro：小程序+H5）+ `packages/shared`
- [ ] 统一 TypeScript/ESLint/Prettier 配置；约定版本（Node LTS、pnpm）与目录规范（见 `docs/engineering/repo-structure.md`）
- [ ] 本地一键启动：`docker-compose`（Postgres + Redis + MinIO）+ `apps/api`（热更新）
- [ ] OpenAPI 驱动：生成 client SDK/类型（或在 `packages/shared` 维护 DTO 与枚举，和 `docs/api/openapi.yaml` 对齐）
- [ ] Mock 驱动并行开发：基于 `docs/api/openapi.yaml` 启动 mock（Prism/fixtures），并提供“场景切换”（退款失败/回调重放/无数据等）
- [ ] CI（可选）：lint + typecheck + OpenAPI lint（`npx -y @redocly/cli lint docs/api/openapi.yaml`）

### 7.2 数据库与迁移（M1）

- [ ] 落 Prisma schema（对齐 `docs/architecture/er-diagram.mmd`）：orders/listings/patents/files/users/settlements/refunds/cases/system_configs 等
- [ ] 核心索引：
  - [ ] Search：标题/摘要/权利人等 FTS（P0）
  - [ ] 幂等/回调：`idempotency_keys`、支付回调去重键、退款去重键
  - [ ] 推荐：`view_count/favorite_count/consult_count` + 去重窗口表/缓存键策略
- [ ] Region 字典与地图数据表：`regions`（含 `industry_tags_json`）、`industry_tags`、`patent_map_entries`（含 regionCode+year 唯一键）
- [ ] 种子数据：区域字典（省/市层级）、默认系统配置（交易规则/推荐权重）

### 7.3 登录鉴权与用户（M1）

- [ ] 微信小程序登录：`/auth/wechat/mp-login`（code→openid/session→token）
- [ ] H5 登录（电脑端）：短信验证码登录 `/auth/sms/send` + `/auth/sms/verify`
- [ ] JWT + RBAC（后台角色：运营/客服/财务/管理员；前台用户：买家/卖家）
- [ ] 身份/主体认证：首次登录必须选择身份（个人/企业/科研院校/政府/协会/技术经理人）
  - [ ] 个人：授权信息后可直接完成注册（无需后台审核）
  - [ ] 其他类型：提交信息+材料→后台 approve/reject；通过后解锁发布/交易（企业/科研院校默认进入“机构展示”目录）

### 7.4 文件与对象存储（M1）

- [ ] `/files` 上传（MinIO/S3 兼容）；文件元数据落库（purpose/owner/acl/hash）
- [ ] 鉴权下载：订单证据/合同/发票等按权限返回临时 URL（或走 API 转发）
- [ ] （可选）水印：对关键文件提供“带水印预览”能力（P1）

### 7.5 专利号码规范化与专利主数据（M1）

- [ ] `/patents/normalize`：按 PRD 的正则与规范化规则输出 `application_no_norm/publication_no_norm/patent_no_norm/type`
- [ ] 专利主数据录入：支持用户上传/后台录入为准；字段校验与去重策略（允许多卖家同号上架）

### 7.6 上架/审核/检索（M2）

- [ ] 卖家上架：草稿→编辑→提交审核→上架→下架（对齐 `docs/architecture/flow-listing-publish.mmd`）
- [ ] 后台审核：通过/驳回（原因）；驳回后可修改再提交
- [ ] 检索：`/search/listings`（游客可用）+ 过滤（类型/地区/标签/IPC/LOC/法律状态/价格/订金）+ 排序（推荐/最新/热门/价格）
- [ ] 详情（公开）：`/public/listings/{listingId}`（不返回权属材料等敏感附件）
- [ ] 详情（卖家/已登录）：`/listings/{listingId}`（返回可编辑/敏感字段）

### 7.7 智能推荐与地域特色（M2）

- [ ] 事件采集：浏览/收藏/咨询（去重窗口：同用户/设备 24h 记 1 次）
- [ ] 推荐公式与权重：后台可配置（`/admin/config/recommendation`），变更即时生效
- [ ] 区域特色置顶：后台标记 listing 为省/市级特色（`/admin/listings/{listingId}/featured`）
- [ ] “猜你喜欢”：`/me/recommendations/listings`（登录用户）+ 游客默认用 `/search/listings?sortBy=RECOMMENDED`

### 7.8 专利地图（M2）

- [ ] Region CMS：区域维护、区域产业标签维护（`/admin/regions*`、`/admin/industry-tags`）
- [ ] 地图数据录入：区域+年份数据（`/admin/patent-map/regions/{regionCode}/years/{year}`）
- [ ] Excel 导入：`/admin/patent-map/import`
- [ ] 前台查询：`/patent-map/years`、`/patent-map/summary`、`/patent-map/regions/{regionCode}`（游客可用）

### 7.9 咨询/聊天（M2）

- [ ] 会话：`/listings/{listingId}/conversations`（创建/获取）+ `/me/conversations`（列表）
- [ ] 消息：拉取/发送/已读（`/conversations/{conversationId}/messages`、`/conversations/{conversationId}/read`）
- [ ] 传输形态（选最低成本）：HTTP 轮询/长轮询（P0）；如需更顺滑可加 WebSocket（P1）

### 7.10 订单状态机与支付（M2）

- [ ] 订单状态机：对齐 `docs/architecture/state-order.mmd`；关键状态变更必须落审计
- [ ] 订金支付：创建订单→生成支付意图→微信支付回调验签解密→入账→状态推进（见 `docs/architecture/sequence-deposit-payment.mmd`）
- [ ] 合同签署确认：后台里程碑确认写入成交价并解锁尾款（对齐 PRD 与 OpenAPI）
- [ ] 尾款支付：仅小程序发起；电脑端 H5 展示“去小程序支付”（二维码/链接）
- [ ] 支付幂等：Idempotency-Key + 回调重放防护；支付/退款对账表（最小）

### 7.11 退款与争议（M2/M3）

- [ ] 买家发起退款：自动秒退窗口；超窗进入人工审核（见 `docs/architecture/sequence-refund.mmd`、`docs/architecture/flow-refund-dispute.mmd`）
- [ ] 后台审批：通过→调用微信退款→回调→状态收敛；驳回→留痕
- [ ] 证据链：聊天记录/合同/快递单等附件归档与权限控制

### 7.12 结算与放款（M2/M3）

- [ ] 结算台账：佣金（卖家承担）计算与扣减；生成待放款记录
- [ ] P0 放款：财务线下打款→后台录入凭证（文件）→订单完成（见 `docs/architecture/sequence-settlement.mmd`）
- [ ] 对账报表（最小）：订单流水、退款流水、放款流水导出

### 7.13 发票（M3）

- [ ] 口径：订单完成后线下人工开票→后台上传电子发票文件→订单页下载（不做邮箱投递）
- [ ] 接口：`/admin/orders/{orderId}/invoice` 上传/替换 + `/orders/{orderId}/invoice` 下载

### 7.14 前端交付（小程序 + H5 + 后台）

- [ ] Taro 用户端（小程序 + H5 同构复用）：
  - [ ] 首次登录：身份选择注册（个人直过；其他提交审核）
  - [ ] 游客：搜索/列表/详情（公开）
  - [ ] 登录后：收藏、咨询/聊天、下单、订单进度
  - [ ] 支付：小程序内完成；H5 仅引导回小程序
  - [ ] UI/交互：橙色主题 + 金豆矿视觉点缀；全量状态（loading/empty/error/权限/审核中）可演示
- [ ] Admin Web（React/AntD）：审核、订单、退款、里程碑、放款、发票、配置、地图 CMS
  - [ ] UI/交互：橙色主题；权限态与审计提示清晰

### 7.15 上线准备（M3）

- [ ] 三方资质/参数：微信开放平台、小程序类目、微信支付商户号与证书、短信签名、对象存储（阶段性补齐）
- [ ] 域名与回调：支付回调域名、业务域名、下载域名白名单
- [ ] 安全基线：限流、敏感字段脱敏、审计日志、管理员操作二次确认（关键按钮）

## 8. 演示材料（给甲方）

- [x] 一页“平台定位 & 主链路”说明（图 + 关键规则）：`docs/demo/platform-onepager.md`
- [x] 3 张 C4 + 3 张时序 + ER + 业务流程（合并成演示顺序清单）：`docs/demo/presentation-order.md`
- [x] OpenAPI（Swagger/Redoc 预览方案）：`docs/api/README.md`
- [x] Mermaid 图渲染/导出方案（PNG/PDF，用于 PPT/标书）：`docs/architecture/README.md` + `scripts/render-diagrams.ps1`
- [x] 演示图表包（更“高端”版本）与导出：`docs/demo/diagrams/` + `docs/demo/README.md`
- [x] 甲方演示“话术脚本/FAQ”（资金托管、合同线下、放款条件、风险提示）：`docs/demo/faq.md`
- [x] 发票与税务说明（展示口径，需财务/法务确认）：`docs/legal/invoice-tax.md`
- [x] PRD 每页功能图（小程序/后台）与导出：`docs/demo/pages/README.md`
- [x] 小程序 01-15 页面图合成单图：`docs/demo/rendered/miniapp-pages-01-15.png`

## 9. 前期准备完整性检查（签字前最后一遍）

- [x] PRD / ER / OpenAPI / 图表：术语、字段名、枚举、金额单位（分）、状态机完全一致
- [x] P0/P1 边界清晰：P0 不接外部专利数据源；P1 才接适配层；P0 放款=人工回传凭证
- [x] 第三方资质与参数清单：微信登录、微信支付（商户号/证书/APIv3Key/回调域名）、短信、对象存储
- [x] 合规与风控：隐私政策/协议清单完整；证据材料访问鉴权与审计；导流/重复上架/冒用权属处置
- [x] 发票闭环：开票字段/权限/审计留痕与 ER/OpenAPI/页面图一致
- [x] 演示可导出：所有 Mermaid 图可批量导出 PNG/PDF；OpenAPI 可本地预览

## 10. 开发开工前置（M0.5/M1，建议按顺序做）

- [ ] 工程化约定一次定稿：
  - [x] Node 版本约定（`.nvmrc`）
  - [x] 包管理器（pnpm，Corepack）
  - [x] Monorepo（pnpm workspace + Turborepo）
  - [x] Prettier（根配置）
  - [ ] ESLint（待补齐：统一规则 + 提交前校验）
- [x] 按 `docs/engineering/repo-structure.md` 落地工程目录（`apps/*`、`packages/*`）+ 一键本地依赖（`docker-compose.yml`）
- [x] OpenAPI 工具链落地（契约先行）：
  - [x] `pnpm openapi:lint`
  - [x] `pnpm openapi:preview`（默认 `http://127.0.0.1:8080`）
  - [x] `pnpm mock`（Prism：`http://127.0.0.1:4010`）
- [ ] Mock 驱动并行开发（见 `docs/engineering/mocking.md`）：
  - [ ] fixtures 场景（happy/empty/error/edge）落地，支持 `X-Mock-Scenario` 一键切换（当前仅建目录）
  - [ ] 覆盖难场景：退款失败、回调重放、订单非法跳转、无数据、未登录/无权限、审核中/驳回
- [ ] 前端骨架演示交付物（给甲方，后端未就绪也能演示；见 `docs/engineering/frontend-skeleton.md`）：
  - [ ] 用户端（Taro 小程序 + H5）：
    - [x] 工程骨架 + TabBar + 基础页面（Home/Search/Publish/Messages/Me/Login/Onboarding）
    - [ ] 接入 Prism Mock（基于 `docs/api/openapi.yaml`）并对齐字段/枚举
    - [ ] 全量状态机（loading/empty/error/permission/audit）覆盖所有页面
  - [ ] 后台（React/AntD）：
    - [x] 工程骨架 + Layout + 菜单页骨架
    - [ ] 接入 Prism Mock + 表格/详情页骨架（审核/订单/退款/放款/发票/配置/地图）
  - [x] 视觉规范落地：橙色主题 +「专利变金豆矿」点缀（`docs/engineering/design-system.md`）
  - [ ] 演示脚本：固定 fixtures + 一键启动（Mock + 前端）+ 截图/录屏清单
- [ ] 后端骨架（便于并行）：
  - [x] NestJS 工程骨架 + `/health`
  - [ ] 模块划分（auth/user/patent/listing/order/payment/refund/settlement/file/config）
  - [ ] DB/Redis 连接（Postgres + Redis）+ Prisma 迁移基线
  - [ ] 统一错误码与审计日志基线
