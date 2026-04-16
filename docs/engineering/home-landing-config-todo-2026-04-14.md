# 首页运营配置直发版改造 TODO（2026-04-14）

## 决策对齐

- 已确认采用 `方案B`：先做“可配置直发版”，不引入草稿/发布流。
- 本期目标：把首页核心运营位改为后台可配置，并打通“首页卡片 -> 搜索筛选”一致性。
- 本期不做：配置审批、版本回滚 UI、灰度发布、A/B 实验。

## 已确认边界（2026-04-14）

- [x] 特色专区不足 `4/6` 时采用“强制补齐”策略（不允许前台少卡展示）。
- [x] `listingTopicUi.enabled` 开关需同步到全部相关功能，不只小程序搜索页。
- [x] 快捷入口范围已确认：目标区域是首页 Banner/公告下方的“快捷入口宫格（home-quick）”，但本期保持固定不配置化。

## 当前现状（基线）

- 首页以下内容仍为前端硬编码：
  - Hero 标签文案（3 个）
  - 特色专区卡片（标题、副标题、图片、跳转）
  - 快捷入口（图标、标题、跳转）
  - 部分模块标题文案
- Banner 与首页公告已支持后台配置，可作为复用范式（`system_config` + `/admin/config/*` + `/public/config/*` + 审计日志）。
- 搜索页“特色标签”来自静态枚举，首页专区卡片与搜索标签未实现统一运营配置源。

## 改造范围

### In Scope

- 新增首页配置中心键：`home_landing_config`（JSON 配置）。
- 管理后台新增“首页运营配置（直发）”编辑能力。
- 小程序首页改为配置驱动（文案、卡片、图片、跳转）。
- 首页快捷入口（`home-quick`）保持固定 8 项，不纳入后台配置。
- 支持特色专区展示数量为 `4` 或 `6`（可配置）。
- 搜索页“特色标签”显示顺序/显示开关/中文名与首页配置对齐。

### 快捷入口范围定义（本期）

- 位置：`首页 -> Banner/公告下方 -> 快捷入口宫格（home-quick）`。
- 当前入口（8个）：
  - 外观专利
  - 发明专利
  - 实用新型
  - 机构
  - 发明人榜
  - 专利地图
  - 技术经理
  - 成果展示
- 本期方案：保持固定 8 槽位与现有样式，不改页面结构；仅统一其点击动作与标签值域（避免多处散落常量）。
- 跳转口径：
  - `技术经理`：进入咨询页并默认选中 `技术经理人(TECH)` Tab。
  - `机构`：进入咨询页并默认选中 `机构(ORG)` Tab（与技术经理共用同一页面）。

### Out of Scope

- 草稿/发布/下线状态机。
- 回滚历史页面与差异对比 UI。
- 多端多语言配置（本期统一中文）。

## 目标配置模型（草案）

```json
{
  "schemaVersion": 1,
  "hero": {
    "tags": ["0元专利托管", "0元代办过户", "0风险交易"],
    "searchPlaceholder": "开始寻找被你发现的IP"
  },
  "sectionTexts": {
    "featuredTitle": "特色专区",
    "featuredMoreText": "更多"
  },
  "featuredZones": {
    "enabled": true,
    "displayCount": 4,
    "items": [
      {
        "id": "retired",
        "title": "退役专利",
        "subtitle": "平台审核通过的退役专利",
        "imageUrl": "https://.../zone-retired.jpg",
        "enabled": true,
        "order": 10,
        "actionType": "SEARCH_PREFILL",
        "actionPayload": {
          "tab": "LISTING",
          "listingTopic": "HIGH_TECH_RETIRED",
          "reset": true
        }
      }
    ]
  },
  "listingTopicUi": {
    "items": [
      { "value": "HIGH_TECH_RETIRED", "label": "退役专利", "enabled": true, "order": 10 },
      { "value": "SLEEPING", "label": "沉睡专利", "enabled": true, "order": 20 },
      { "value": "AWARD_WINNING", "label": "获奖专利", "enabled": true, "order": 30 },
      { "value": "FIVE_STAR", "label": "五星专利", "enabled": true, "order": 40 },
      { "value": "OPEN_LICENSE", "label": "开放许可", "enabled": true, "order": 50 }
    ]
  }
}
```

## 后端规划 TODO（apps/api）

- [ ] `ConfigService` 新增 `KEY_HOME_LANDING = 'home_landing_config'`。
- [ ] 新增 `HomeLandingConfig` 类型与默认值构建函数（保证首启可用）。
- [ ] 新增配置标准化与字段校验：
  - [ ] `displayCount` 仅允许 `4 | 6`。
  - [ ] `featuredZones.items` 启用数量必须 `>= displayCount`（强制补齐规则）。
  - [ ] `title/subtitle` 长度限制。
  - [ ] `imageUrl` 非空与长度限制。
  - [ ] `actionType` 白名单：`SEARCH_PREFILL | PAGE_ROUTE`。
  - [ ] `actionPayload` 按 `actionType` 分支校验。
  - [ ] `listingTopic` 必须属于后端枚举集合。
- [ ] `PublicConfigController` 新增 `GET /public/config/home-landing`。
- [ ] `AdminConfigController` 新增：
  - [ ] `GET /admin/config/home-landing`
  - [ ] `PUT /admin/config/home-landing`
- [ ] 审计日志：新增 `CONFIG_HOME_LANDING_UPDATE`。
- [ ] 单测补齐：
  - [ ] `config.service.spec.ts`
  - [ ] `admin-config.controller.spec.ts`
  - [ ] `public-config.controller.spec.ts`

## 管理后台规划 TODO（apps/admin-web）

- [ ] 在 `ConfigPage` 增加“首页运营配置（直发）”卡片（本期不拆新路由）。
- [ ] 表单化编辑能力：
  - [ ] Hero 标签（最多 3 条）与搜索占位文案。
  - [ ] 特色专区卡片增删改、排序、启用、图片上传、动作配置。
  - [ ] 特色专区 `displayCount` 单选（4/6）。
  - [ ] `listingTopicUi` 顺序/名称/开关。
- [ ] 表单校验与即时错误提示（禁止提交非法配置）。
- [ ] 保存后调用 `PUT /admin/config/home-landing` 直发生效。
- [ ] 文案统一中文，不出现英文状态标签。

## 小程序端规划 TODO（apps/client）

- [ ] 新增 `homeLandingConfig.ts`：
  - [ ] 类型定义与解析函数。
  - [ ] `fetchHomeLandingConfig()`。
  - [ ] 轻量兜底：仅兜底到后端默认配置结构，不再兜底为“演示假数据”。
- [ ] 首页 `pages/home/index.tsx` 改造：
  - [ ] Hero 标签与搜索占位文案使用配置值。
  - [ ] 特色专区卡片数据使用配置值。
  - [ ] 根据 `displayCount` 渲染 4 或 6 张卡片。
  - [ ] 快捷入口保持固定实现（不读取配置），但点击链路统一：
    - [ ] 技术经理 -> 咨询页 `TECH` Tab
    - [ ] 机构 -> 咨询页 `ORG` Tab
  - [ ] 卡片点击动作使用配置定义（优先 `SEARCH_PREFILL`）。
- [ ] 图片加载失败降级处理（单图失败不影响全页）。
- [ ] 保留现有 Banner 与公告加载链路，不回退到本地 mock 入口。
- [ ] 新增“咨询页默认 Tab”意图传递（如 storage 一次性标记），避免 TabBar 页面无法直接带 query 参数。

## 搜索与标签一致性 TODO（apps/client + apps/api）

- [ ] 搜索页“特色标签”选项读取 `listingTopicUi`（按 `enabled/order/label`）。
- [ ] 若 `listingTopicUi` 缺失某枚举，前端按枚举默认中文补齐（保证筛选可用，不制造假标签）。
- [ ] 首页专区卡片与搜索筛选共用同一 `listingTopic` 值域。
- [ ] 管理后台涉及 `ListingTopic` 的页面同步统一配置（减少多处重复常量）。

### `listingTopicUi.enabled` 开关同步范围（本期）

- [ ] 小程序首页：
  - [ ] 特色专区卡片绑定 `listingTopic` 时，若该标签关闭则不可上架该卡或前台不展示。
- [ ] 小程序搜索：
  - [ ] “特色标签”筛选项跟随开关展示/隐藏。
- [ ] 小程序发布页：
  - [ ] 发布专利时 `listingTopic` 选项跟随开关展示/隐藏。
- [ ] 管理后台：
  - [ ] `ListingsAuditPage` 标签筛选/编辑选项跟随开关。
  - [ ] `PlatformConversationsPage` 标签筛选跟随开关。

## 无“虚拟占位/假打通”治理 TODO

- [ ] 首页相关链路不再使用本地演示卡片数据作为业务兜底。
- [ ] 配置读取失败时展示“可恢复空态 + 重试”，不展示与真实配置无关的占位内容。
- [ ] 管理后台配置页面保存后可立即通过公开接口验证生效结果。
- [ ] 对“demo-only”开关继续保持生产门禁，不允许 release 环境开启。

## 联调与验收清单（DoD）

- [ ] 后台修改 `displayCount=4`，首页稳定展示 4 张专区卡片。
- [ ] 后台修改 `displayCount=6`，首页稳定展示 6 张专区卡片。
- [ ] 当 `displayCount=4/6` 时，后台保存校验会阻止“启用卡片不足”配置（强制补齐）。
- [ ] 后台下线某卡片，首页不展示且点击链路不存在。
- [ ] 首页卡片点击后，搜索页筛选条件正确预填（`listingTopic/patentType/tab/reset`）。
- [ ] 搜索页“特色标签”名称与顺序与后台配置一致。
- [ ] 关闭任一 `listingTopic` 后，首页特色专区/搜索/发布/后台相关标签入口同步隐藏。
- [ ] 首页 8 宫格不再承载任何单一特色标签入口（避免与上方特色专区语义重叠）。
- [ ] 年费托管页面文案抽检为中文（本次不回归英文残留）。
- [ ] `api/admin-web/client` 相关 lint + typecheck + 关键测试通过。

## 风险与处理

- 风险：配置结构过大导致 `ConfigPage` 过重。
  - 处理：本期先在 `ConfigPage` 落地，字段分区折叠；后续可独立新路由页面。
- 风险：运营误配动作参数导致跳转异常。
  - 处理：前后端双校验 + 动作白名单 + 示例模板。
- 风险：标签被关闭后历史数据仍有该 `listingTopic`。
  - 处理：仅隐藏“新选择入口”，不删除历史数据；列表展示与检索仍兼容旧数据。

## 实施顺序（建议）

- [ ] 第1步：后端配置模型 + 接口 + 测试。
- [ ] 第2步：后台配置 UI（直发）。
- [ ] 第3步：首页配置驱动改造。
- [ ] 第4步：搜索标签一致性改造。
- [ ] 第5步：联调验收 + 文档回填（将本文待办改为已完成）。

## 边界确认结论（已回填）

- [x] 快捷入口纳入本期范围，但保持“固定 8 槽位”不配置化（页面结构不改）。
- [x] 特色专区不足 4/6 时采用强制补齐（保存校验拦截）。
- [x] `listingTopicUi` 开关同步到全部相关功能（首页/搜索/发布/后台筛选）。
## 2026-04-14 落地进展（执行版）

- [x] 后端新增 `home_landing_config` 配置模型与接口（`/public/config/home-landing`、`/admin/config/home-landing`）。
- [x] 后端完成强校验：`displayCount` 仅 `4|6`、启用卡片数量强制补齐、动作类型白名单、`listingTopicUi` 联动校验。
- [x] 首页完成配置驱动：Hero 标签、搜索占位、特色专区标题/更多、特色卡片数据与动作。
- [x] 首页快捷入口保持固定 8 槽位，并将“五星专利”替换为“机构”，与“技术经理”共用咨询页不同默认 Tab。
- [x] 搜索页“特色标签”改为读取 `home-landing` 的 `listingTopicUi`，并自动清理失效筛选值。
- [x] 发布页“特色标签”改为读取 `home-landing` 的 `listingTopicUi`，并自动清理失效选项。
- [x] 后台 `ListingsAuditPage`、`PlatformConversationsPage`、`PatentOperationsPage` 改为统一读取可用标签配置。
- [x] 后台 `ConfigPage` 新增“首页运营配置（直发）”JSON 配置卡片并支持保存。
- [x] 全量 typecheck / 测试 / 回归验证（关键测试与三端 typecheck 已通过）。

## 2026-04-14 后台入口可见性补充
- [x] 管理后台新增独立入口页面：`/config/home-landing`（路由 + 菜单项 `首页运营配置`）。
- [x] 仪表盘“快捷操作”新增 `首页运营配置` 直达入口，避免入口埋在综合配置页内不易发现。
- [x] 入口权限统一为 `config.manage`；若当前账号无该权限，菜单与快捷入口均不会显示。
- [x] 权限排查指引：可通过 `/auth/session` 检查 `permissions` 是否包含 `config.manage`。
