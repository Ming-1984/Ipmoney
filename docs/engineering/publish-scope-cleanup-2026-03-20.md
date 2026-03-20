# 发布能力收敛与功能下线方案（专利交易 + 专利成果）

## 目标
- 发布中心仅保留两个入口：**发布专利交易**、**发布专利成果**（沿用现有成果发布与管理页面）。
- **彻底下线**书画专区与产学研需求相关能力（前端入口、页面、后端接口、数据库与文档）。
- 发布管理/个人中心/收藏等相关能力同步收敛。

## 范围与假设
- “专利成果”复用当前 `achievement` 体系（页面、API、数据模型）并统一文案。
- 书画（artwork）与需求（demand）从产品与技术栈彻底移除。
- 不保留兼容入口与旧路由；若需保留则以 410 或引导页明确下线。

## 影响清单（高层）
### 前端
- 发布中心四卡 → 二卡：`pages/publish`
- 发布管理四项 → 二项：`pages/publish`、`pages/me`
- 搜索 Tab 移除书画/需求
- 我的内容页移除书画/需求
- 相关图标、插画与资源清理
- 收藏页面仅保留专利交易/专利成果

### 后端
- OpenAPI 删除 demand/artwork 相关路径与 schema
- 移除 demand/artwork 模块、服务、控制器、数据映射
- Prisma 删除 demand/artwork 模型及关联表/枚举
- 数据库迁移：drop 表/索引/枚举值

### 文档与测试
- 需求/设计/矩阵/权限等文档同步收敛
- API/客户端/测试夹具同步更新

## 分阶段计划（执行顺序）

### 1) 产品与路由层统一
- 明确“发布专利成果”的路由与页面命名：沿用 `subpackages/publish/achievement`。
- 统一文案：成果展示/成果案例 → 专利成果（含“我的成果案例”相关文案）。

### 2) 前端发布入口与管理入口收敛
**发布中心**
- 文件：`apps/client/src/pages/publish/index.tsx`
  - `publishItems` 仅保留：发布专利交易、发布专利成果
  - 移除 artwork/demand 相关 icon 与 onClick
- 文件：`apps/client/src/pages/publish/index.scss`
  - 2 卡布局（合并原 2×2 为 2 张卡）

**个人中心发布管理**
- 文件：`apps/client/src/pages/me/index.tsx`
  - 发布管理项仅保留“我的专利”“我的专利成果”
- 文件：`apps/client/src/pages/me/index.scss`
  - 发布管理网格布局调整为 2 项

### 3) 下线书画与需求页面
- 删除发布页：
  - `apps/client/src/subpackages/publish/artwork/*`
  - `apps/client/src/subpackages/publish/demand/*`
- 删除我的列表页：
  - `apps/client/src/subpackages/my-artworks/*`
  - `apps/client/src/subpackages/my-demands/*`
- 删除浏览/详情页：
  - `apps/client/src/subpackages/artwork/*`
  - `apps/client/src/subpackages/demand/*`
- 移除所有导航入口（全局 `navigateTo` 路由清理）

### 4) 收藏功能收敛
**前端**
- 文件：`apps/client/src/subpackages/favorites/index.tsx`
  - 移除 demand/artwork 收藏页签、数据拉取与展示
  - 仅保留 listing/achievement 收藏
- 删除收藏入口中指向 demand/artwork 的跳转

**后端**
- OpenAPI 移除 demand/artwork 收藏相关路径
- 服务端移除 demand/artwork 收藏逻辑与校验
- 清理 favorite 相关表中 demand/artwork 数据（迁移或脚本）

### 5) 搜索与列表收敛
- 文件：`apps/client/src/subpackages/search/index.tsx`
  - 搜索 Tab 移除需求/书画
  - 搜索数据处理仅保留 listings/achievements
- 若有推荐/首页板块涉及需求/书画，清理入口与数据源

### 6) 后端 API 与模型下线
- OpenAPI (`docs/api/openapi.yaml`)
  - 删除 `demands`, `artworks` 相关 schemas、paths、tags
- 服务端模块
  - 删除 `demands`、`artworks` controller/service/repo 相关文件
  - 移除与 `comments/favorites/search` 的关联分支
- Prisma (`apps/api/prisma/schema.prisma`)
  - 删除 Demand/Artwork 相关 models、枚举、关系
- 迁移
  - 新增迁移 drop 对应表、索引、枚举值

### 7) Mock / fixtures / 测试清理
- `apps/mock-api` 移除 demand/artwork 相关路由
- `packages/fixtures` 删除 demand/artwork 数据块与场景引用
- `apps/api/test` 删除 demand/artwork 相关测试或重写为仅剩类型

### 8) 文档同步
更新以下文档以反映“只保留专利交易 + 专利成果”：
- `Ipmoney.md`（需求说明）
- `docs/engineering/traceability-matrix.md`
- `docs/engineering/page-api-test-matrix-*.md`
- `docs/engineering/permissions-matrix.md`
- `docs/engineering/openapi-coverage.md`
- `docs/architecture/er-diagram.mmd`（移除 demand/artwork 实体关系）
- `docs/architecture/c4-container.mmd`（去除相关服务描述）

## 验收标准
1) 发布中心仅显示“发布专利交易 / 发布专利成果”两入口。
2) 个人中心发布管理仅保留“我的专利 / 我的专利成果”。
3) 搜索/收藏/详情页不再出现需求/书画相关内容与入口。
4) OpenAPI 不再暴露 demand/artwork 相关接口。
5) 数据库中 demand/artwork 相关表与数据已移除（或迁移完成）。

## 风险与回滚
- 删除需求/书画模块为不可逆变更，需提前导出历史数据（如需保留）。
- 迁移落库后需要备份与回滚脚本（可用 `pg_dump` + 反向迁移）。

## 待确认
- 是否需要保留“专利成果”历史数据与收藏数据（默认保留）。
- 是否需要新增下线引导页或 410 响应（默认直接移除入口）。
