# 数据硬编码清单（初版，2026-02-19）

> 目标：明确“哪些是演示/开发硬编码数据”，以及“对应的替代方案（fixtures / 后台配置 / 真接口）”。

## 1. 后端（apps/api）

### 1.1 prisma/seed.js（演示数据）
- **开关**：
  - `SEED_BASE_DATA=true|false`（默认 true，仅基础配置/地区）
  - `SEED_DEMO_DATA=true|false`（默认 false，演示数据）
  - `SEED_DEMO_PURGE_MAP=true|false`
- **硬编码内容**（仅用于 demo/开发）：
  - 系统配置：`trade_rules`、`recommendation_config`
  - 专利地图示例：`patent_map_entries`（2024/2025 示例数据）
  - Demo 用户：`DEMO_USER_ID` / `DEMO_ADMIN_ID`
  - 公告/通知/地址等示例记录
- **替代方案**：
  - 生产环境关闭 `SEED_DEMO_DATA`，仅保留 `SEED_BASE_DATA`（基础配置/地区）
  - 示例数据改由 fixtures（`packages/fixtures/scenarios/*`）提供
  - 若需可运营配置，沉淀为后台可编辑配置（SystemConfig）

## 2. 前端（apps/client）

### 2.1 首页入口/专区卡片（静态配置）
- 位置：`apps/client/src/pages/home/index.tsx`
- 内容：快捷入口、专区卡片（icon/文案/跳转）
- 方案：保持静态（产品级固定入口）或迁移为 CMS 配置（`/admin/config` + `system_config`）

### 2.2 筛选/表单枚举（静态选项）
- 位置：`apps/client/src/subpackages/search/index.tsx`、`subpackages/publish/*/index.tsx`
- 内容：tradeMode/patentType/priceType 等枚举选项
- 方案：
  - 继续使用 OpenAPI enum（通过 `lib/labels` 统一映射）
  - 若需后台可配置，考虑引入字典/枚举配置接口

### 2.3 Demo 登录入口
- 位置：`apps/client/src/pages/me/index.tsx`、`subpackages/login/index.tsx`
- 开关：`DEMO_AUTH_ENABLED`
- 方案：生产环境默认关闭，入口仅保留 dev

## 3. 后台（apps/admin-web）

- 目前未发现硬编码业务数据（大部分为 UI 枚举/标签）。
- 若后续出现静态运营项，建议落到 `system_config` 并在后台配置。

## 4. 下一步

- 按模块补充“硬编码数据 → fixtures/配置/真实接口”的映射表
- 将 seed 分拆为：
  - **基础系统配置 seed（生产可用）**
  - **演示 seed（dev-only，可一键清理）**

