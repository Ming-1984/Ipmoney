# Ipmoney（专利交易平台）TODO（先文档定稿，再开工）

> 目标：支持 **微信小程序 + 用户 H5（电脑端可用） + PC Web 管理后台**；在正式开发前，先把 PRD / 架构图 / 业务流程图 / ER / OpenAPI 做到“可签字、可联调、可交付演示”。

## 0. 里程碑与验收口径

- [ ] **M0：文档签字版（对甲方演示用）**（文档已齐，待甲方确认/签字）
  - [x] PRD 无“待确认”项（均转为 P0 默认值或明确标注 P1）
  - [x] C4（Context/Container/Component）+ 关键时序图 + ER 图 + 业务流程图（BPMN/Flowchart）齐全且一致
  - [x] OpenAPI 覆盖 P0 主链路且字段/枚举与 ER/状态机一致
  - [x] **演示级图表包**：业务泳道逻辑图 + P0/目标架构 + 部署图 + 资金/数据流安全边界（代码生成，可导出 PNG/PDF）
- [x] **M0.5：前端骨架演示（Mock 驱动，不等后端）**
  - [x] 用户端（小程序 + H5）：页面骨架 + 交互/状态机（loading/empty/error/权限/审核中/不可操作原因提示）完成
  - [x] 后台（Admin Web）：关键页面骨架完成（认证审核/上架审核/订单/退款/放款/发票/地图 CMS）
  - [x] OpenAPI Mock 可运行：可切换“正常/失败/重放/无数据”等场景；fixtures 可复用做截图与演示
  - [x] 视觉规范落地：主色橙色（寓意成功），「专利点金台」视觉点缀（见 `docs/engineering/design-system.md`）
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
  - [x] `Idempotency-Key`（建议）与回调验签 Header（Wechatpay-\*）说明（占位）

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
- [x] `docs/engineering/execution-playbook.md`（执行 Playbook：Mock 先行、后端逐模块替换）
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

- [x] 初始化 Monorepo（pnpm workspace）：`apps/api` + `apps/admin-web` + `apps/client` + `apps/mock-api` + `packages/fixtures`（`packages/shared` 后续需要再抽）
- [x] 统一 TypeScript/ESLint/Prettier 配置；约定版本（Node LTS、pnpm）与目录规范（见 `docs/engineering/repo-structure.md`）
- [x] 本地一键启动：`docker-compose`（Postgres + Redis + MinIO）+ `apps/api`（热更新，`pnpm dev:api`）
- [x] OpenAPI 驱动：生成类型（`pnpm openapi:types` → `packages/api-types/index.d.ts`，与 `docs/api/openapi.yaml` 对齐）
- [x] Mock 驱动并行开发：基于 `docs/api/openapi.yaml` 启动 mock（Prism/fixtures），并提供“场景切换”（退款失败/回调重放/无数据等）
- [x] fixtures UUID quality: use valid UUIDs in fixtures/demo data (keep strict route param validation); run `node scripts/fixture-uuids.mjs --check|--write`
- [x] CI（可选）：lint + typecheck + OpenAPI lint（见 `.github/workflows/ci.yml`）

### 7.2 数据库与迁移（M1）

- [x] 落 Prisma schema（对齐 `docs/architecture/er-diagram.mmd`）：`apps/api/prisma/schema.prisma`
- [ ] 核心索引：
  - [ ] Search：标题/摘要/权利人等 FTS（P0）
  - [ ] 幂等/回调：`idempotency_keys`、支付回调去重键、退款去重键
  - [ ] 推荐：`view_count/favorite_count/consult_count` + 去重窗口表/缓存键策略
- [x] Region 字典与地图数据表：`regions`、`industry_tags`、`patent_map_entries`（含 regionCode+year 唯一键）
- [x] 种子数据：省级区域字典 + 默认系统配置（交易规则/推荐权重）：`apps/api/prisma/seed.js`

### 7.3 登录鉴权与用户（M1）

- [ ] 微信小程序登录：`/auth/wechat/mp-login`（code→openid/session→token）
  - [ ] P0（最快可跑）：未配置 `WX_MP_APPID/WX_MP_SECRET` 时允许 demo 模式（仅本地/演示，返回 demo user + `demo-token`）
  - [ ] P1（真实接入）：配置 `WX_MP_APPID/WX_MP_SECRET` 后，服务端调用微信 `code2Session`（`/sns/jscode2session`）换取 `openid/session_key`，按 `openid` 映射用户并签发平台 token
- [ ] 用户资料（头像/昵称）（P0）：小程序端“用户点击触发”采集并落库
  - [ ] 头像：`chooseAvatar` → `POST /files`（`purpose=AVATAR`）→ `PATCH /me { avatarUrl }`
  - [ ] 昵称：`<input type="nickname">` → `PATCH /me { nickname }`
  - [ ] 后端/DB：`User.avatarUrl` 落库；`PATCH /me` 不再忽略 `avatarUrl`；`GET /me` 返回 `avatarUrl`
  - [ ] 前端 UI：我的页头部用 NutUI `Avatar/Cell/Tag` 统一展示（头像/昵称/认证状态）
- [ ] （可选，P1）手机号绑定（微信能力）
  - [ ] 小程序：`<button open-type="getPhoneNumber">` 拿到 `code`（动态令牌）
  - [ ] 服务端：调用 `phonenumber.getPhoneNumber` 换取手机号并绑定到用户
  - [ ] 依赖决策：维持 `User.phone` 必填（则绑定手机号必须在微信登录链路早期完成）或改为可空（先 openid 建用户，后续补手机号）
- [ ] H5 登录（电脑端）：短信验证码登录 `/auth/sms/send` + `/auth/sms/verify`
- [ ] JWT + RBAC（后台角色：运营/客服/财务/管理员；前台用户：买家/卖家）
- [ ] 身份/主体认证：首次登录必须选择身份（个人/企业/科研院校/政府/协会/技术经理人）
  - [ ] 个人：授权信息后可直接完成注册（无需后台审核）
  - [ ] 其他类型：提交信息+材料→后台 approve/reject；通过后解锁发布/交易（企业/科研院校默认进入“机构展示”目录）

### 7.4 文件与对象存储（M1）

- [x] `/files` 上传（P0：本地落盘 `UPLOAD_DIR` + `/uploads` 静态服务；P1：MinIO/S3）；文件元数据落库（url/mime/size/owner）
- [ ] 鉴权下载：订单证据/合同/发票等按权限返回临时 URL（或走 API 转发）
- [ ] （可选）水印：对关键文件提供“带水印预览”能力（P1）

### 7.5 专利号码规范化与专利主数据（M1）

- [x] `/patents/normalize`：按 PRD 的正则与规范化规则输出 `applicationNoNorm/applicationNoDisplay/publicationNoNorm/kindCode/patentType`
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
- [ ] “沉睡专利（入口）”：`/me/recommendations/listings`（登录用户）+ 游客默认用 `/search/listings?sortBy=RECOMMENDED`

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
- [x] 前端已落实：H5 不发起支付，微信内 openTag 跳小程序；微信外/桌面二维码+复制链接（订金/尾款页）
- [x] 前端已落实：订单详情 WAIT_FINAL_PAYMENT 展示“支付尾款”入口
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

- [x] 工程化约定一次定稿：
  - [x] Node 版本约定（`.nvmrc`）
  - [x] 包管理器（pnpm，Corepack）
  - [x] Monorepo（pnpm workspace + Turborepo）
  - [x] Prettier（根配置）
  - [x] ESLint（统一规则 + `pnpm lint` 校验）
- [x] 按 `docs/engineering/repo-structure.md` 落地工程目录（`apps/*`、`packages/*`）+ 一键本地依赖（`docker-compose.yml`）
- [x] Git 仓库与 GitHub（协作/CI）：
  - [x] 本地 git 初始化并完成初始提交
  - [x] GitHub 配置文件（Actions CI / Dependabot / PR Template）
  - [x] 添加 GitHub remote 并 push（已连接仓库并推送）
- [x] OpenAPI 工具链落地（契约先行）：
  - [x] `pnpm openapi:lint`
  - [x] `pnpm openapi:preview`（默认 `http://127.0.0.1:8080`）
  - [x] `pnpm mock`（fixtures + Prism fallback：`http://127.0.0.1:4010`）
- [x] Mock 驱动并行开发（见 `docs/engineering/mocking.md`）：
  - [x] fixtures 场景（happy/empty/error/edge）落地，支持 `X-Mock-Scenario` 一键切换
  - [x] 覆盖难场景：退款失败、回调重放、订单非法跳转、无数据、未登录/无权限、审核中/驳回
    - [x] 回调重放/幂等冲突（`payment_callback_replay`：支付意图 409）
    - [x] 退款失败（`refund_failed`：退款审批通过 409）
    - [x] 状态机冲突（`order_conflict`：里程碑确认 409）
- [x] 前端骨架演示交付物（给甲方，后端未就绪也能演示；见 `docs/engineering/frontend-skeleton.md`）：
  - [x] 用户端（Taro 小程序 + H5）：
    - [x] 工程骨架 + TabBar + 基础页面（Home/Search/Publish/Messages/Me/Login/Onboarding）
    - [x] 接入 Mock（`apps/mock-api`：fixtures + Prism fallback）并对齐字段/枚举（Search/List/Detail 已接入）
    - [x] 订金支付演示链路（创建订单 → 创建支付意图 → 成功页）
    - [x] 全量状态机（loading/empty/error/permission/audit）覆盖所有页面（含搜索/地图/发明人榜/机构展示/会话）
  - [x] 后台（React/AntD）：
    - [x] 工程骨架 + Layout + 菜单页骨架
    - [x] 接入 Mock + 表格/详情页骨架（审核/订单/退款/放款/发票/配置/地图）
      - [x] 认证审核列表（`/admin/user-verifications`）+ 通过/驳回（演示）
      - [x] 上架审核列表（`/admin/listings`）+ 通过/驳回（演示）
      - [x] 订单管理：里程碑确认（合同确认/变更完成）（演示）
      - [x] 退款管理：按订单查看退款单 + 审批通过/驳回（演示）
      - [x] 交易/推荐配置（`/admin/config/*`）+ 保存（演示）
      - [x] 放款/结算（`/admin/orders/*/settlement` + `/payouts/manual`）+ 上传凭证（演示）
      - [x] 发票管理（`/admin/orders/*/invoice`）+ 上传/删除（演示）
      - [x] 专利地图 CMS（`/admin/patent-map/*`）+ 录入/更新（演示）
  - [x] 视觉规范落地：橙色主题 +「专利点金台」点缀（`docs/engineering/design-system.md`）
  - [x] 演示脚本：固定 fixtures + 一键启动（Mock + 前端）+ 截图/录屏清单（`scripts/demo.ps1` + `docs/demo/runbook.md`）
  - [x] 修复 Turbo `envMode=strict` 导致动态端口不生效（`turbo.json` 的 `globalPassThroughEnv`）
  - [x] 用户端默认路由兼容误访问 `/#/pages`（自动跳转到 `/#/pages/home/index`）
- [ ] 后端骨架（便于并行）：
  - [x] NestJS 工程骨架 + `/health`
  - [ ] 模块划分（已落地：auth/users/regions/patent-map/config；待落地：patents/files/listings/search/orders/payments/refunds/cases/settlement/messaging）
  - [ ] DB/Redis 连接（Postgres + Redis）+ Prisma 迁移基线
    - [x] Prisma schema 初版（对齐 `docs/architecture/er-diagram.mmd`）：`apps/api/prisma/schema.prisma`
    - [x] 生成迁移基线并写入 `prisma/migrations/*`（已生成 `apps/api/prisma/migrations/20260111185000_init/`；环境具备 DB 后再跑 `pnpm -C apps/api db:migrate` 做落库校验）
  - [x] mock-api “上游替换”开关（按模块把部分路由转发到真实 API，其余仍走 fixtures/Prism）
  - [x] `/files`（P0：本地落盘 `UPLOAD_DIR`；P1：对象存储）基础能力落地
  - [x] `/patents/normalize` 落地（号码正则/规范化；与 PRD 3.6 + OpenAPI 对齐）
  - [ ] 统一错误码与审计日志基线（关键后台操作留痕）

## 11. P0 交付级 UI 打磨（主程序优先：小程序/H5）

> 目标：在不等后端的前提下，把“用户端主链路页面”的视觉与交互做到可演示、可交付；尽量使用现成组件/低成本实现。

### 11.1 视觉资源（先定稿再铺开）

- [x] 确认品牌 Logo（动图）：`apps/client/src/assets/brand/logo.gif`
- [x] 落地 Logo 到多端资源目录：
  - [x] 用户端（Taro）：`apps/client/src/assets/brand/logo.gif`
  - [x] 后台（Admin Web）：`apps/admin-web/src/assets/brand/logo.gif`
- [x] TabBar 图标（灰/橙两套，5 组共 10 张 PNG，小程序可用）：
  - [x] `home/search/publish/messages/me` + `*-active`
  - [x] 路径：`apps/client/src/assets/tabbar/*`

### 11.2 用户端（小程序 + H5 同构）UI 优化（优先展示给甲方）

- [x] 首页（Home）：品牌头图（Logo +「专利点金台」）+ 关键入口卡片更“像产品”
- [x] 沉睡专利入口（跳转搜索）：入口文案与跳转策略统一（跳转搜索）
- [x] 检索（Search）：筛选区（专利类型/交易方式/价格类型/地域）+ 排序（推荐/热度/发明人影响力）
- [x] 列表卡片（ListingCard）：价格/订金/标签/按钮样式统一；空态/错误态更友好
- [x] 详情页（Listing Detail）：首屏信息结构（标题/类型/价格/订金/卖家/权属材料）+ CTA（咨询/下单）
- [x] 下单支付：订金/尾款支付页统一为“摘要 + 金额强调 + 关键说明 + CTA”（含吸底按钮）
- [x] 身份注册/认证：选择身份卡片化 + 资料提交表单（含证明材料上传）+ 审核中态引导
- [x] 发明人榜：榜单卡片样式 + 影响力解释（来自平台上传专利统计）
- [x] 专利地图：地图页的图例/数字展示（区域专利数量）更清晰

### 11.3 后台（Admin Web）视觉补强（低成本）

- [x] 布局品牌化：侧边栏顶部加入 Logo + 标题
- [x] 表格页统一空态/加载态/错误提示（对齐用户端状态机）
- [x] 关键页面（审核/退款/放款/发票）加强操作确认与审计提示（文案/视觉）

### 11.4 演示输出（截图/录屏）

- [x] 更新 `docs/demo/runbook.md`：补充“页面访问路径/常见启动故障排查”
- [x] 更新 `docs/demo/pages/README.md`：补充“最新 UI 版本截图”导出清单

## 12. 生产级 UI 全面美化（移动端优先，先做用户端）

> 设计范式与落地规则：`docs/engineering/ui-guidelines.md`

### 12.0 UI v2（体系优先 A）落地清单（待确认后实施）

> 本轮你选择 **A：体系级先做**。详细 TODO（含验收口径与逐页接入清单）统一放在：`docs/ui-v2-todo.md`
> - 规范基准：`docs/engineering/ui-v2-spec.md`
> - 页面审计：`docs/engineering/ui-v2-page-audit.md`、`docs/engineering/ui-v2-page-by-page.md`
> - 验收清单：`docs/engineering/ui-v2-qa-checklist.md`

### 12.1 已确认（默认方案）

- [x] 主色：`#FF6A00`（更浓厚橙色）；如需换色优先改 token（多端一致）
- [x] 组件库：相关成熟功能优先使用成熟组件库提效（P0 引入 NutUI Taro；业务域组件仍以 `ui/*` 自研为主）
- [x] Mock 场景切换入口：默认隐藏；需要演示/调试时通过 `scripts/demo.ps1 -EnableMockTools` 开启

### 12.2 设计 Token 与基础样式（用户端 + 后台一致）

- [x] 统一色彩 token（主色更浓厚）+ 字号/间距/圆角/阴影规范
- [x] 统一按钮（Primary/Ghost/Danger/Disabled）与表单输入样式
- [x] 统一 Chip/Tag（筛选/标签）样式与交互反馈（按下态/禁用态）
- [x] 统一页面状态组件（loading/empty/error/permission/audit）视觉与文案

### 12.3 用户端（小程序/H5）页面逐个提升（P0 主路径）

- [x] 12.3.0 组件库落地（NutUI Taro）
  - [x] 安装依赖：`@nutui/nutui-react-taro`（含 icons）
  - [x] 全局样式引入 + 主题变量映射到 `apps/client/src/app.scss`（主色/圆角/字体/背景）
  - [x] 封装适配层：`apps/client/src/ui/nutui/*`（Button/SearchBar/Segmented/Cell/Dialog/Toast/Steps…）
  - [x] 约束：业务域组件继续用 `apps/client/src/ui/*`（避免在页面里到处直接依赖 NutUI，便于未来替换/升级）
  - [x] 验收：H5+小程序均可编译运行（`pnpm -C apps/client build:h5`、`pnpm -C apps/client build:weapp`）

- [x] 12.3.1 基础版式与交互范式（先统一，再铺开页面）
  - [x] 顶部 Hero/Header 组件：标题/副标题/右侧标签（可复用）
  - [x] 列表容器：筛选条/列表 + Skeleton/Empty/Error 一致化
  - [x] 底部吸附 CTA：统一 StickyBar（按钮宽度/禁用态/金额展示/安全区）
  - [x] 表单范式：必填/错误提示/多行输入/图片上传（走组件库）
  - [x] 轻量图标体系：优先用 NutUI Icons（避免新增大量 png）
  - [x] 运行时错误兜底：全局 ErrorBoundary（页面渲染异常可直接显示错误信息便于排查）


- [x] 12.3.1.1 顶部栏品牌化补齐：全站统一顶部栏组件（左侧 Logo；非 Tab `Back + Logo`；标题/副标题排布一致）
- [x] 12.3.2 首页（对外第一屏，优先“像产品”）
  - [x] 搜索入口：用组件库 SearchBar/输入交互统一（回车/清空）
  - [x] 快捷入口：栅格卡片统一（沉睡专利/检索/地图/发明人榜/机构展示）
  - [x] 推荐区：展示“推荐分/热度/地域特色”标签；按钮与卡片密度统一
  - [x] 游客态文案：明确“可看/需登录且审核通过”（收藏/咨询/下单/支付）


- [x] 12.3.2.1 首页快捷入口按钮优化：沉睡专利/发明人榜/专利地图/机构展示（排版 + 尺寸；优先 NutUI `Grid` 收口）
- [x] 12.3.2.2 Home 副标题：`专利变金豆矿` → `专利点金台`
- [x] 12.3.3 沉睡专利入口（跳转搜索）
  - [x] Segmented：推荐/最新/热度（组件库）
  - [x] 卡片：地域特色置顶、行业标签、推荐分/热度表达更清晰
  - [x] 刷新：刷新按钮 + 首屏 Skeleton（P0）（下拉刷新 P1）

- [x] 12.3.4 检索（核心页面）
  - [x] 搜索条：SearchBar + 回车搜索 + 清空
  - [x] 筛选：Popup（基础：类型/交易/价格）
- [x] Filters: finish "more filters" per ui-v2-filter-mapping.md (LISTING: deposit/ipc/loc/legalStatus + public industry tags; DEMAND/ACHIEVEMENT: public industry tags).
  - [x] 排序：推荐/热度/最新/发明人影响力（组件库 Segmented）
  - [x] 结果列表：统一 ListingCard（价格/订金/标签/按钮）；空态引导更友好

- [x] 12.3.5 详情页（转化）
  - [x] 首屏结构：价格/订金/卖家/热度/标签（密度与层级优化）
  - [x] 风险提示：合同线下、尾款平台支付、变更完成后放款（卡片化）
  - [x] 底部 CTA：咨询 + 支付订金（金额/权限态文案）

- [x] 12.3.6 下单/支付（订金→尾款）
  - [x] 订金页：订单摘要 + 金额强调 + 关键说明 + 吸底 CTA
  - [x] 成功页：里程碑 Steps（订金→合同→尾款→变更→放款）+ 下一步引导
  - [x] 尾款页：说明占位 + 吸底 CTA

- [x] 12.3.7 消息/咨询（工单式 IM，非实时）
  - [x] 会话列表：Cell 列表 + 未读徽标 + 最后消息/时间（组件库）
  - [x] 会话页：气泡/输入条/发送态；证据材料上传入口占位（P1 可补）

- [x] 12.3.8 我的（身份与能力入口）
  - [x] 个人卡：头像/昵称/手机；认证类型/状态 Tag 统一（通过/审核中/驳回）
  - [x] 常用入口：统一 Cell（身份认证/咨询消息/机构展示）

- [x] 12.3.9 身份注册/资料提交（首次进入）
  - [x] 身份选择：卡片栅格化（个人秒通过，其它需审核）
  - [x] 资料表单：Input/TextArea + 图片上传（证明材料）+ 校验与提交态
  - [x] 审核中态：明确“可做什么/不可做什么”，驳回原因展示占位

- [x] 12.3.10 发明人榜
  - [x] Top3 高亮 + 统计口径说明（来自平台内上传专利统计）
  - [x] 搜索/刷新体验（P0）

- [x] 12.3.11 机构展示
  - [x] 卡片化：Logo/名称/类型/地区/数据（上架数/专利数）/简介
  - [x] 只有审核通过才展示（对齐 PRD）

- [x] 12.3.12 专利地图
  - [x] 年份切换：组件库 Segmented；列表/卡片化统计更清晰
  - [x] 说明：P0 数据由后台维护（示例口径/图例）

- [x] 12.3.13 发布入口与表单（卖家侧）
  - [x] 发布类型入口（专利/需求/成果）卡片化 + 说明文案
  - [x] 表单分组：基本信息/权属材料/价格与交易/地域产业标签
  - [x] 必填校验/提交成功态/审核中态（与后台审核联动）

### 12.4 后台（Admin Web）生产级美化（低成本）

- [x] 更浓厚橙色主题（AntD token）+ 页面背景/卡片/按钮统一
- [x] 菜单与顶部栏更品牌化（Logo + 标题）+ 关键操作二次确认/审计提示强化
- [x] 表格页统一空态/错误态/加载态；详情页抽屉/弹窗排版更清晰

## 13. M0.6：用户端移动端体验 & 可用性修复（甲方可验收）

> 背景：当前骨架虽可跑通演示，但仍存在“手机端不易观看/排版异常（如首页快捷入口文字竖排）”与“部分页面点击/流程不顺”的问题，需要一次系统性整改。

### 13.1 验收口径（先定清再动手）

- [ ] 真机/模拟器覆盖：375/390/414 宽度下（iOS/Android）首页与主路径无明显排版异常
- [ ] 主路径可用：Home->Search/Feeds/Detail->咨询/订金支付->成功页；Publish->专利发布->保存草稿->提交审核->审核中态
- [ ] 交互正确：TabBar/返回/吸底按钮不遮挡；点击热区足够；loading/empty/error/权限拦截一致
- [ ] H5 路由稳定：打开 `http://127.0.0.1:<port>/` 默认进首页；任意页面跳转不白屏（方案B：保留自定义路由）
- [ ] 稳定性：happy 场景下无明显控制台报错；error/empty 场景下页面可恢复（重试/刷新）

### 13.2 全局排版与可读性（不改接口契约）

- [x] 统一文本块级展示：避免 `Text` inline 导致“标题+副标题连成一串/窄屏竖排/每字换行”
- [x] 统一文本工具类：已落地 `clamp-1/2`、`break-word`、`flex-1/min-w-0`、`text-title/text-subtitle/text-caption`（全站复用）
- [x] 字体与行高梯度：Hero/标题/正文/辅助信息在小屏可读（避免过大导致换行错乱）
- [x] 栅格与密度：列表/卡片留白、圆角、阴影在小屏不显拥挤（优先保证信息层级）
- [x] 触控热区：按钮/卡片/筛选 chip 点击区域 ≥ 44px（等效）
- [x] Safe Area：TabBar 与 StickyBar 不遮挡内容（含 iPhone 底部安全区）
- [x] 成熟组件引入提效（限定范围，避免风格混乱）：优先 NutUI 现成组件（Grid/NoticeBar/Divider/Avatar/Tag/Picker/ActionSheet 等），并统一经 `ui/nutui/*` 适配层输出

### 13.3 首页（截图问题优先修）

- [x] 快捷入口卡片：改为“图标在上 + 文案在下”的栅格；标题/副标题分行、限制行数（1–2 行）+ 省略号
- [x] Hero 头图：标题/副标题换行策略与对齐；避免遮挡 logo/装饰图
- [x] 搜索条：placeholder 不被挤压；右侧“检索”在小屏不抢占宽度（必要时改为 icon + 小字）
- [x] 推荐区：卡片层级与 CTA（咨询/下单）节奏更清晰（减少“演示感”文案）

### 13.4 页面点击/路由冒烟（逐页列清并修复）

- [x] 逐页检查入口（Home 快捷入口、列表卡片、详情 CTA、发布入口、消息列表、我的入口）均可点开
- [x] TabBar 页统一使用 `switchTab`，非 Tab 页用 `navigateTo`
- [x] 登录/认证拦截可回跳：登录页改为“完成后返回上一页”；身份选择（个人）完成后返回上一页，避免“登录后被强制跳到固定页”
- [x] 审核未过不可交易：收藏/咨询/下单/支付/发布/消息统一拦截（`ensureApproved`）
- [x] 消息/咨询链路可用：创建会话->进入会话->发送消息->刷新列表（happy/empty/error 场景各验一次）
- [x] 订金支付链路可用：创建订单->创建支付意图->成功页（含异常场景：回调重放/幂等冲突提示）
- [x] 发布链路可用：保存草稿->提交审核->审核中态；后台审核通过后可在前台检索/详情展示（happy 场景）
- [x] 常见失败兜底：接口失败 toast + ErrorCard；空数据 EmptyCard；权限不足跳登录

### 13.5 交付演示“固定路径”与截图

- [x] 固定演示路径（URL/点击序列）清单：写入 `docs/demo/runbook.md`
- [x] 更新页面截图清单：`docs/demo/pages/README.md`（保证与最新 UI 一致）

### 13.6 H5 路由稳定性（方案B：去除 customRoutes，统一 pages 路由）

> 目标：用户端 H5（`apps/client`）在任何入口/跳转下都不出现白屏；URL 规范统一，便于甲方演示与未来部署。

- [x] 修复默认入口白屏：`/`、`/#/`、`/#/pages` 自动跳到 `/#/pages/home/index`
- [x] 统一 Tab 页路由：`/#/pages/home/index`、`/#/pages/search/index`、`/#/pages/publish/index`、`/#/pages/messages/index`、`/#/pages/me/index`
- [x] 兼容旧演示短链：`/#/home` 等在页面刷新时自动跳到对应 `/#/pages/...`（见 `apps/client/src/index.html`）
- [x] 统一页面跳转：Tab 页用 `switchTab`；非 Tab 页用 `navigateTo`
- [x] 更新演示 runbook：写清 H5 规范 URL 与常见白屏排查

### 13.7 WeUI 风格布局重构（系统化解决“比例/卡片/大小”问题）

> 目标：从“活动页式大圆角/厚阴影/胶囊按钮/卡片堆叠”迁移到 **微信/WeUI 的 Surface + CellGroup（分割线列表）**，整体更高级、更舒适，且页面密度更合理。

- [x] 设计系统重置（全站）：按钮从胶囊改为 8–12px 圆角矩形；阴影降级（默认无/轻）；卡片尽量少用
- [x] 统一基础组件：`Surface`（白底内容面）/`CellRow`（分割线行）/`Toolbar`（排序+筛选）/`SearchEntry`（WeUI 形态）
- [x] 首页重排：品牌条扁平化 + Grid 文案不折行 + 搜索条 WeUI 化 + 推荐区“更像微信列表”
- [x] 检索页重排：去掉多层 Card 堆叠，改为“顶部工具区 + 结果列表”；筛选项用 chip（高度 44px 等效）
- [x] 列表项重做：`ListingCard` → 更微信的列表项（信息层级/按钮尺寸/间距），避免大装饰背景
- [x] 我的/消息/发布等页：逐页迁移到 Surface + CellGroup；减少大圆/大阴影造成的“老年感”

## 14. 需求 → OpenAPI → 前端实现 覆盖度审计（防遗漏）

> 目标：把“PRD 功能点/页面”与“OpenAPI operationId/字段枚举”以及“前端页面/Mock fixtures”做成一张可追踪清单，确保没有遗漏与对不齐。

- [x] 生成 P0 Traceability Matrix：`docs/engineering/traceability-matrix.md`
  - 补充接口层自动化报告：`docs/engineering/openapi-coverage.md`（由 `scripts/audit-coverage.mjs` 生成）
  - PRD（`Ipmoney.md`）页面/功能点
  - OpenAPI：operationId + 路由 + 核心字段/枚举
  - 前端：页面入口/组件/状态机分支（loading/empty/error/permission/audit）
  - Mock：fixtures 是否覆盖（happy/empty/error/edge）
- [x] 逐项标注：`P0 已实现` / `P0 占位（待后端）` / `P1` / `不做`
- [x] 拉齐差异并回填：缺接口/缺字段/缺枚举/缺页面/缺状态机分支
- [x] 输出“遗漏清单”（按影响排序）：直接影响甲方演示/验收的优先修复，其余进入 P1
- [x] 校验命令与门槛（通过才算“可开工”）：
  - [x] `pnpm openapi:lint` 通过
  - [x] `pnpm -C apps/client typecheck && pnpm -C apps/client build:h5 && pnpm -C apps/client build:weapp` 通过
  - [x] `pnpm -C apps/admin-web typecheck && pnpm -C apps/admin-web build` 通过
  - [x] Demand/Achievement module plan: see `docs/todo-demand-achievement.md`

### 14.1 接口 × 页面“未对齐项”收口（按演示/验收优先级）

> 依据：`docs/engineering/traceability-matrix.md` 的“缺口清单” + `docs/engineering/openapi-coverage.md` 的“OpenAPI 定义但前端未使用”。

- [x] 认证闭环后端化：前端从“本地存储演示态”迁移到 `POST/GET /me/verification`（并确保 `/me` 展示字段一致），补齐 fixtures（happy/empty/error）
- [x] 收藏闭环：实现 `POST/DELETE /listings/{listingId}/favorites` + `GET /me/favorites`；前端补“收藏列表页”与列表/详情的收藏切换；补齐 fixtures
- [x] 机构详情页：补 `pages/organizations/detail`（点击机构列表进入详情），对接 `GET /public/organizations/{orgUserId}`；补齐 fixtures
- [x] 专利地图 drilldown：补 `pages/patent-map/region-detail`（从地图列表点击进入），对接 `GET /patent-map/regions/{regionCode}?year=`；补齐 fixtures
- [x] 交易规则前台可见：新增“交易规则/订金与退款说明”页，对接 `GET /public/config/trade-rules`（P0 展示即可）；补齐 fixtures
- [x] 卖家侧“我的发布/上架管理”页：对接 `GET /listings`、`GET /listings/{listingId}`、`POST /listings/{listingId}/off-shelf`（确认是否作为 P0 验收项；否则标 P1 并写清）
- [x] 后台上架审核补“省/市级特色置顶”：在 `apps/admin-web` 上架审核页增加操作，对接 `PUT /admin/listings/{listingId}/featured`（featuredLevel=PROVINCE/CITY/NONE），补齐 fixtures
- [x] 后台地区/行业标签管理（运营配置）：对接 `/admin/regions`、`/admin/industry-tags`、`PUT /admin/regions/{regionCode}/industry-tags`（确认 P0 需要与否；不做则在矩阵标 P1）
- [x] 后台专利地图 Excel 导入：对接 `POST /admin/patent-map/import`（确认 P0 需要与否；不做则在矩阵标 P1，并从文档/页面移除“已实现”的描述）
- [x] 收口校验：重新运行 `node scripts/audit-coverage.mjs`，同步更新 `docs/engineering/openapi-coverage.md` 与 `docs/engineering/traceability-matrix.md`

## UI v2 polish (client)

- [x] Messages: PullToRefresh + conversation cell polish
- [x] Chat: ScrollView + message types + history pagination + send retry
- [x] Details: Patent/Demand/Achievement consistent meta + media section reuse
- [x] Details v2.2: 留言区（公开列表 + 互动回复 + 编辑/删除）- Listing/Demand/Achievement 详情页底部
- [x] Admin v2.2: 留言管理（列表/搜索/筛选 + 隐藏/恢复/删除）
- [x] Details v2.2: Demand/Achievement 顶部信息区重排（Tag/Space/Avatar；行业/地区/时间/热度更可扫读）
- [x] Messages v2.1: conversation list UI refresh (NutUI Avatar/Badge/Tag/Cell; WeChat-like density)
- [x] Details v2.1: VIDEO playback polish (fixtures URL not example.com + MediaList Video onError fallback)
- [x] Listing Detail v2.1: top “category/tags” section refactor (Tag/Space; avoid MetaPills overload)
- [x] Listing Detail v2.3: seller + stats area uses NutUI Avatar/Tag/Space (avoid MetaPills mixing)
- [x] Patent Detail v2.3: hero uses NutUI Tag/Space + copy applicationNo
- [x] Org Detail v2.4: hero uses NutUI Avatar/Tag/Space (remove MetaPills)
- [x] Patent Map Region Detail v2.4: hero uses NutUI Tag/Space (remove MetaPills)
- [x] Trade Rules v2.4: metrics use NutUI Tag/Space (remove MetaPills)
- [x] Payment Success v2.4: order summary uses NutUI Tag/Space (remove MetaPills)
