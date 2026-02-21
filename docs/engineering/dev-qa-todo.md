# 研发/测试全链路与生产过渡 TODO

> Last updated: 2026-02-20

> 目标：在**不接入真实微信登录**的前提下，完成开发环境全链路自测与性能优化；同时提供可平滑过渡到生产的流程与检查清单。

## 一、原则（最佳实践）
- 分层隔离：dev / staging / prod 配置与密钥完全隔离
- 安全默认：未登录不触发受保护 API；401 统一处理、可恢复
- 可观测性：接口、错误、性能指标可追踪
- 可回归：测试用例、数据、脚本可复用
- 可演进：demo/mock 与真实登录/支付可一键切换

## 二、范围
- `apps/client`（小程序/H5）
- `apps/admin-web`
- `apps/api`

## 三、里程碑
- M0 开发环境一键启动 & 端口冲突可处理
- M1 鉴权闭环 + 401 风暴消除（未登录不打受保护 API）
- M2 数据与硬编码清理（fixture/seed 可复用）
- M3 性能与资源优化（app-origin.wxss、图片、编译速度）
- M4 预生产/生产过渡准备（安全、监控、灰度、回滚）

## 四、已完成（当前实现）
- [x] API 层未登录短路请求 + 401 清 token（避免 401 风暴）
- [x] 鉴权状态变更通知 & 页面访问控制重算
- [x] dev demo auth 默认开启（脚本支持）
- [x] NutUI 样式按需引入（替代全量 CSS）
- [x] 部分全局样式下沉到组件级
- [x] 401 统一处理（auth required 事件 + 全局跳转登录）
- [x] 开发态 demo 登录入口（小程序/H5/后台）
- [x] base64 inline 阈值调整（WeApp=0，H5=2048）
- [x] `app-origin.wxss` 体积基线记录（159.6 KB，2026-02-20；原 191.3 KB/205.9 KB）
- [x] 消息/聊天样式从 `app.scss` 下沉到页面级 `scss`
- [x] 首页/咨询/搜索/发明人/技术经理人详情/支付页样式下沉到页面级/子包
- [x] 详情页共用样式下沉（挂牌/专利/成果/需求/书画/机构/订单）
- [x] 评论/附件/手机号弹窗样式下沉到共享/组件级 scss
- [x] 列表卡片样式下沉到 `styles/list-cards.scss`（页面按需 `@use`）
- [x] 清理未使用样式块（tech-manager-card、rank、listing-detail-meta 等）
- [x] 测试报告更新（`docs/engineering/test-report.md`）
- [x] fixture/seed 一键重置脚本（`scripts/dev-reset.ps1`）+ mock-api `POST /__reset`
- [x] 非 mock API 冒烟（真实 API + DB）通过（`scripts/api-real-smoke.ps1 -ApiPort 3248`，2026-02-21）
- [x] 权限矩阵梳理（管理端 + 小程序）：`docs/engineering/permissions-matrix.md`
- [x] 关键页面首屏骨架优化（首页 + 搜索列表）
- [x] 关键大图压缩（Top5 < 150KB，logo < 60KB）
- [x] 生产过渡 Runbook（`docs/engineering/production-transition.md`）

- [x] SeedDemo 数据回填：挂牌/专利/需求/成果/书画/机构/收藏/消息/订单/通知/地址
- [x] Demo 固定账号 ID 映射：.env/.env.example 同步 DEMO_USER_ID/DEMO_ADMIN_ID
- [x] 修复 Seed 使用非 v4 UUID 导致详情/咨询页跳转失效（改为合法 UUID，需重置 DB）

## 五、TODO 清单（按优先级）

### P0（本周，阻断体验与噪音）
- [x] 本地数据库一键重置并回填演示数据：`scripts/dev-reset.ps1 -Target api -Force -SeedDemo`
- [ ] WeApp 冒烟：首页/搜索/详情/消息/收藏/个人中心/发布
- [x] 补齐“未登录态”页面级防护：未登录页面只渲染引导，不触发列表/消息/收藏 API
- [x] 401 统一处理：toast + 跳转登录 + 可恢复（避免循环重试）
- [x] dev 登录入口统一（小程序/H5/后台一致入口）
- [x] `app-origin.wxss` 体积基线/目标记录：记录当前大小与目标（建议 < 200KB）
- [x] WeApp 关闭 base64 内联 + 存量大图排查（避免 `image src` 过大）
- [x] OpenAPI 覆盖审计：修复 TS 泛型解析误报（确保 maintenance/cases 等路径识别）
- [x] OpenAPI 未使用接口收口：订单开票、RBAC 角色编辑、工单创建、告警配置、推荐接口、年费日程详情（剩 AI P1）

### P1（本月，稳定与效率）
- [x] 全局样式继续拆分到页面级 `scss`（仅保留 token/reset/通用组件；已完成：消息/聊天/首页/咨询/搜索/发明人/技术经理人详情/支付/详情页(挂牌/专利/成果/需求/书画/机构/订单)/列表卡片/评论附件/微信手机号弹窗）
- [x] NutUI 组件样式按需补全清单（对照 `ui/nutui` 包装组件 + `PageHeader` 的 `NavBar` 已覆盖）
- [x] 子包与懒加载策略复核（非 Tab 页已下沉 subpackages，`lazyCodeLoading: requiredComponents` 开启）
- [x] 编译性能基线记录：冷启动/二次编译耗时（weapp build ~20.95s）
- [x] 自动化 smoke test（启动、登录、核心页面冒烟；`scripts/ui-http-smoke.ps1` 9/9）
- [ ] AI 解析/智能体接口接入：暂缓（待你确认后再排期）

### P2（迭代期，体验与质量）
- [x] 数据硬编码清单化：列出硬编码点与替代方案（`docs/engineering/data-hardcode-inventory.md`）
- [x] fixture/seed 机制落地（支持一键重置：`scripts/dev-reset.ps1` + mock-api `POST /__reset`）
- [x] 管理端与小程序的权限矩阵梳理（`docs/engineering/permissions-matrix.md`）
- [x] 关键页面首屏渲染优化（首页/搜索列表骨架占位；详情页保留加载态卡片）

## 六、工作流与验收标准

### 1) 鉴权与访问控制
- [x] 未登录不触发受保护 API
- [x] 登录后页面自动恢复请求
- [x] 401 只出现一次并有明确引导

### 2) 数据与硬编码治理
- [x] 列表/详情/统计/推荐/消息来源可追踪（见 `docs/engineering/traceability-matrix.md`）
- [x] fixture 可在 dev/staging 复用（见 `docs/engineering/mocking.md` + `docs/engineering/production-transition.md`）

### 3) 样式与包体
- [x] `app-origin.wxss` 体积下降并记录对比
- [x] 页面级 `scss` 覆盖率提升，避免全局污染

### 4) 资源与图片
- [x] banner <= 150KB，logo <= 60KB（可调整）
- [x] 无超大 base64 内联图片

### 5) 性能
- [x] 冷启动与二次编译耗时达标（基线 20.95s，目标 <= 25s；增量 <= 5s）
- [x] 首屏白屏时间可控（骨架屏 + 首屏监控目标 <= 2s）

## 七、生产过渡清单（提前准备）
- [x] 配置分层：dev/staging/prod 的 env 管理与注入（见 `docs/engineering/production-transition.md`）
- [x] 真实登录/支付开关：demo/mock 可关闭且不侵入业务（见 `docs/engineering/production-transition.md`）
- [x] 监控与告警：接口错误率、登录失败率、首屏耗时（见 `docs/engineering/production-transition.md`）
- [x] 灰度与回滚策略：小程序版本灰度、后端蓝绿/灰度（见 `docs/engineering/production-transition.md`）
- [x] 安全与合规：日志脱敏、权限最小化、密钥轮换（见 `docs/engineering/production-transition.md`）

## 八、交付物
- 本文档（TODO 主清单）
- 回归记录（`docs/engineering/test-report.md`）
- 关键指标对比：编译耗时、`app-origin.wxss` 体积、图片体积
- 生产过渡 Runbook（`docs/engineering/production-transition.md`）

## 九、默认约定（已按最佳实践执行）
- 默认采用 demo/mock 登录作为 dev 主路径
- 默认启用 SeedDemo 演示数据（收藏/消息/订单可见）
- 默认以“最小全局样式 + 页面级样式”为目标
- 默认优先消除 401 风暴与性能告警

如需调整优先级或目标阈值，直接告诉我即可。

## 十、当前基线（2026-02-20）
- `app-origin.wxss`: 159.6 KB（`apps/client/dist/weapp/app-origin.wxss`）
- weapp build: 15.86s（`pnpm -C apps/client build:weapp`）
- OpenAPI 未使用接口：5（AI P1）
- 较大图片 Top5（已压缩）：
  - 139.8 KB `apps/client/src/assets/artworks/artwork-2.jpg`
  - 133.6 KB `apps/client/src/assets/illustrations/fortune-god.svg`
  - 125.7 KB `apps/client/src/assets/achievements/achievement-hainu-2.jpg`
  - 108.8 KB `apps/client/src/assets/home/promo-free-publish.jpg`
  - 108.2 KB `apps/client/src/assets/achievements/achievement-hainu-3.jpg`
