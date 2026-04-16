# 管理后台首页运营配置入口可见性说明（2026-04-14）

## 目标
- 解决“管理后台看不到首页运营配置控制页面”的可发现性问题。
- 保持权限模型不放松，避免越权访问配置能力。

## 已落地
- 新增独立路由：`/config/home-landing`。
- 侧边菜单新增入口：`首页运营配置`。
- 仪表盘快捷操作新增入口：`首页运营配置`。

## 权限规则
- 入口权限统一为 `config.manage`。
- 无 `config.manage` 时，菜单与快捷操作都不会显示该入口。
- API 访问同样受 `config.manage` 保护（`GET/PUT /admin/config/home-landing`）。

## 排查步骤
1. 打开 `/auth/session`，确认 `permissions` 包含 `config.manage`。
2. 若不包含，在 RBAC 中为当前账号所属角色补齐 `config.manage`。
3. 重新登录后台，确认以下入口出现：
   - 侧边栏：`首页运营配置`
   - 仪表盘快捷操作：`首页运营配置`
4. 进入 `/config/home-landing` 后执行保存，检查小程序首页/搜索/发布/后台筛选是否同步生效。

## 涉及代码
- `apps/admin-web/src/router.tsx`
- `apps/admin-web/src/ui/AppLayout.tsx`
- `apps/admin-web/src/views/HomeLandingConfigPage.tsx`
- `apps/admin-web/src/views/DashboardPage.tsx`
