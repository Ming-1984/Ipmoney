# Demand & Achievement TODO
#
# This file tracks the planned work to upgrade the Demand (industry-university-research requirements)
# and Achievement (results showcase) features from placeholders to production-ready flows.
# Chinese details start below.

---

# 产学研需求 & 成果展示（从占位到可用）

> 现状：`apps/client/src/pages/publish/demand` 与 `apps/client/src/pages/publish/achievement` 仅支持标题文本提交；缺少字段、附件、草稿、审核态与可展示闭环。  
> 目标：在不破坏现有专利交易主链路的前提下，补齐“需求/成果”的**发布 → 审核 → 展示 → 咨询**闭环，并对齐 UI v2 规范与可用性/无障碍要求。

## 0. 标准与依据（已联网确认）

- 微信小程序设计指南（导航明确，来去自如）：`https://developers.weixin.qq.com/miniprogram/design/`
- WeUI：`https://weui.io/`
- WCAG 2.1：`https://www.w3.org/TR/WCAG21/`
- GB/T 37668-2019《信息技术 互联网内容无障碍可访问性技术要求与测试方法》：`https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=35ECC696805C1A67C93B74FB6D0D8EFB`
- GB/T 45445-2025《电子商务平台适老化通用要求》：`https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=5CCAD18E4F7687C12D1E419533868FC8`

## 1. 已确认（对齐结果）

> 以下均已与你对齐；后续实现与验收口径默认按这些结论执行。

- [x] Industry tags: use public source (GET /public/industry-tags) across Publish/Search/Filters (no free-text as the primary path).


- [x] 信息架构：**进入搜索主链路（Search Tab）**，Search 提供分类切换：专利交易｜产学研需求｜成果展示｜机构
- [x] 权责/可见性：与专利交易一致（公开可浏览；关键动作需登录且审核通过；发布者需审核通过）
- [x] 发布状态机：与专利交易一致（草稿→提交审核→通过上架；驳回可编辑后再提交；支持下架）
- [x] 附件能力：支持图片/文件/视频；可选封面图（视频建议配封面图）
- [x] 联系方式策略（按推荐）：默认仅站内咨询（IM 会话），不直接展示手机号/微信号（需要时作为 P1 扩展）
- [x] 审核策略：与专利交易一致（后台通过/驳回；驳回原因必填且对用户可见；敏感词/图片自动审核作为 P1）

## 2. 字段与校验（对齐 `Ipmoney.md` 9「发布与编辑」）

### 2.1 产学研需求（建议字段）

- [x] 标题*（max 200）
- [x] 技术领域/关键词*（chips/逗号分隔，最多 30 个）
- [x] 需求描述*（max 2000；建议拆：背景/痛点/期望方案/指标）
- [x] 预算范围（min/max；可选；支持“面议”）
- [x] 合作方式（转让/许可/入股/联合开发/委托开发…）
- [x] 期望地区/行业（复用现有 region/industryTags 体系）
- [x] 交付周期（枚举：≤1月/1–3月/3–6月/≥6月；或自由文本）
- [x] 封面图（可选；若有视频建议必填封面图）
- [x] 附件/媒体（图片/文件/视频；至少 1 个作为 P0 验收项）
- [x] 联系人信息（名称/职务/脱敏电话；若走 IM 则可降级为“联系人称呼”）

### 2.2 成果展示（建议字段）

- [x] 标题*（max 200）
- [x] 成果简介*（max 2000；应用场景/亮点/指标）
- [x] 封面图（可选；若有视频建议必填封面图）
- [x] 媒体*（至少 1 张图片；可选视频/文件）
- [x] 成熟度（阶段枚举，例：样机/中试/量产/已落地）
- [x] 所属单位*（如果可从认证主体自动带出则前台展示，表单可隐藏）
- [x] 合作方式（转让/许可/联合开发/产业化合作…）
- [x] 关键词（可选）
- [x] 附件（专利清单/检测报告/路演材料等）

### 2.3 统一校验与交互（P0）

- [ ] 必填/长度/枚举映射统一（错误文案对齐 `docs/engineering/ui-v2-spec.md`）
- [ ] 提交中防重复；失败可重试；成功有明确“下一步”
- [x] 附件上传失败/删除二次确认/上传中态与已上传列表呈现统一（复用 `pages/publish/patent` 交互模式）
- [ ] 草稿防丢（P0 可选，P1 必做）：自动保存/恢复提示/提交成功清理

### 2.4 附件限制（建议默认值，P0）

> 目标：既满足“支持视频”，又避免前期存储/带宽/审核成本失控；后续可通过配置项放开。

- [x] 图片：最多 9 张；单张 ≤ 10MB；格式：jpg/png/webp
- [x] 视频：最多 1 个；≤ 100MB；格式：mp4（h264/aac）；建议必填封面图
- [x] 文件：最多 3 个；单个 ≤ 20MB；格式：pdf/doc/docx/ppt/pptx/xls/xlsx
- [x] 合计：单条内容附件总数 ≤ 12；上传失败可重试；上传中禁止提交

## 3. OpenAPI & 数据模型（先定契约，再做前后端）

> 当前 OpenAPI/Prisma 仅覆盖 `Listing`（专利交易）；需求/成果需新增模型与接口。

### 3.1 OpenAPI（建议最小闭环）

- [x] 已补齐到 `docs/api/openapi.yaml`（仅契约；未实现）
- [ ] `Demands`
  - [x] `GET /search/demands`（公开检索列表）
  - [x] `GET /public/demands/{demandId}`（公开详情）
  - [x] `POST|DELETE /demands/{demandId}/favorites`（收藏/取消收藏）
  - [x] `GET /me/favorites/demands`（我的需求收藏列表）
  - [x] `POST /demands`（创建草稿）
  - [x] `GET /demands`（我的需求：含草稿/审核态）
  - [x] `GET /demands/{demandId}`（详情：发布方）
  - [x] `PATCH /demands/{demandId}`（编辑草稿）
  - [x] `POST /demands/{demandId}/submit`（提交审核）
  - [x] `POST /demands/{demandId}/off-shelf`（下架）
  - [x] `POST /demands/{demandId}/conversations`（站内咨询：IM 会话）
  - [x] `/admin/demands` + `/{demandId}/approve|reject`（后台审核：对齐专利）
- [ ] `Achievements`（同结构）
  - [x] `GET /search/achievements`（公开检索列表）
  - [x] `GET /public/achievements/{achievementId}`（公开详情）
  - [x] `POST|DELETE /achievements/{achievementId}/favorites`（收藏/取消收藏）
  - [x] `GET /me/favorites/achievements`（我的成果收藏列表）
  - [x] `POST /achievements`（创建草稿）
  - [x] `GET /achievements`（我的成果：含草稿/审核态）
  - [x] `GET /achievements/{achievementId}`（详情：发布方）
  - [x] `PATCH /achievements/{achievementId}`（编辑草稿）
  - [x] `POST /achievements/{achievementId}/submit`（提交审核）
  - [x] `POST /achievements/{achievementId}/off-shelf`（下架）
  - [x] `POST /achievements/{achievementId}/conversations`（站内咨询：IM 会话）
  - [x] `/admin/achievements` + `/{achievementId}/approve|reject`（后台审核：对齐专利）

### 3.2 Prisma（建议）

- [ ] 新增 `Demand` / `Achievement`（字段含：title/summary/regionCode/industryTags/media/attachments/auditStatus/status/createdAt/updatedAt）
- [ ] 与 `files` 的关联策略二选一：
  - [ ] 扩展 `FileOwnerScope`：增加 `DEMAND`/`ACHIEVEMENT`（ownerId=对应实体 id）
  - [ ] 或保持 `OTHER`，通过 `FilePurpose` 扩展用途（但 ownerScope 建议仍能区分）
- [ ] 审核日志：复用现有审计体系（类似 `ListingAuditLog`），或抽象为通用 `ContentAuditLog`（P1）
- [ ] 站内咨询（IM）对齐：`Conversation` 从“只支持 listingId”扩展为 `contentType + contentId`（LISTING/DEMAND/ACHIEVEMENT），并让 `GET /me/conversations` 能混合返回三类会话（前端按 contentType 渲染顶部卡片）

### 3.3 Mock/fixtures（演示与回归）

- [x] OpenAPI 增加后，同步补齐 `docs/engineering/openapi-coverage.md` 与 `docs/engineering/traceability-matrix.md`
- [x] fixtures：happy/empty/error/edge；并支持 `X-Mock-Scenario` 切换

## 4. Client（小程序/H5）

### 4.1 发布页（模板 D：Form/Wizard）

- [x] `pages/publish/demand/index`：按字段/校验/附件/草稿/审核态完整实现（不再仅标题）
- [x] `pages/publish/achievement/index`：同上（支持多媒体）
- [x] 统一“返回”入口：对齐 `docs/ui-v2-todo.md` 的 `UI-STD-P0-009`

### 4.2 展示页（列表 + 详情）

- [x] Search 增加分类切换：专利交易｜产学研需求｜成果展示｜机构
  - [x] 专利交易：沿用 `GET /search/listings`
  - [x] 需求：新增 `GET /search/demands`（公开检索列表 + 排序）
  - [x] 成果：新增 `GET /search/achievements`（公开检索列表 + 排序）
  - [x] 机构：沿用 `GET /public/organizations`（Search Tab 内复用 UI 模板 B）
- [x] Search：需求/成果更多筛选对齐（地区/预算/合作方式/成熟度/产业标签），并收敛到统一 `FilterSheet`（见 `docs/engineering/ui-v2-filter-mapping.md`）
- [x] 需求/成果详情页：公开可见；动作（咨询）按“与专利一致”的动作级权限策略拦截（咨询走 `POST /demands/{demandId}/conversations` / `POST /achievements/{achievementId}/conversations`）

## 5. Admin（内容审核）

- [x] 审核列表支持类型筛选：专利/需求/成果（P0 先拆页：需求审核/成果审核）
- [x] 审核详情展示：字段 + 附件预览；通过/驳回二次确认；驳回原因必填并写入审计日志
- [x] 与现有 `listings` 审核/危险操作二次确认策略保持一致（见 `docs/ui-v2-todo.md` Admin P0）

## 6. P0 验收口径（建议）

- [x] 需求发布：至少支持“标题 + 描述 +（≥1 附件）”提交；必填未填不可提交；提交后进入审核中态并可返回
- [x] 成果发布：至少支持“标题 + 简介 +（≥1 图片）”提交；支持预览与删除；提交后同样进入审核态
- [x] 搜索主链路：Search Tab 支持分类切换（专利交易｜产学研需求｜成果展示｜机构），且每类均可检索/进入详情
- [x] 详情闭环：需求/成果详情页公开可见；收藏/咨询动作需登录且审核通过；咨询创建会话后进入 Chat
- [x] 任意非 Tab 页都有可见返回路径；H5 深链打开也能回到首页/上一页（不依赖浏览器按钮）
