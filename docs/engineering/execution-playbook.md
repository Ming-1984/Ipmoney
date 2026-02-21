# 执行 Playbook（Mock 驱动 + WeApp/H5/Admin）

> 最后更新：2026-02-20
> 目标：在不接入真实微信登录/支付的前提下完成开发环境全链路自测，并保持一键切换到生产的能力。

## 本轮问题回顾（WeApp）
- 症状：DevTools 报错 `module ... wxss.js is not defined`，页面未注册。
- 根因：Taro prebundle 产物在 WeApp 运行时无法解析，且缓存残留导致旧文件被加载。
- 修复：仅 H5 开启 prebundle；WeApp 禁用 prebundle。图片 base64 内联关闭；NutUI 改为按需 CSS。
- 追加：OpenAPI 覆盖报告出现 maintenance/cases 误报。
- 根因：`audit-coverage` 对 TS 泛型 `>>` 解析不完整，漏识别 `apiGet<Paged<...>>`。

## 当前状态
### 已完成
- [x] WeApp 禁用 prebundle（仅 H5 dev 使用）
- [x] WeApp base64 内联阈值设置为 0
- [x] NutUI 按需 CSS 替代 Sass `@import`
- [x] 文档统一为 UTF-8
- [x] OpenAPI 结构修复与关键中文恢复
- [x] OpenAPI lint 与后端路由审计一致（0 差异）
- [x] OpenAPI 覆盖审计脚本修复（TS 泛型 `>>`）
- [x] 管理端补齐：订单开票下发、角色编辑、工单创建、告警配置
- [x] 小程序补齐：推荐接口接入（`/me/recommendations/listings`）
- [x] `pnpm -C apps/client build:weapp` 通过
- [x] `scripts/ui-http-smoke.ps1` 通过
- [x] `scripts/ui-render-smoke.ps1` 通过

### 待确认 / 待执行
- [ ] WeChat DevTools 清缓存/重启后验证 `pages/home/index` 是否注册成功
- [ ] 若仍报 prebundle，清理 `apps/client/dist/weapp` 后重编译
- [ ] AI 解析/智能体接口：本轮暂缓（待你确认后再推进）

## 推荐执行顺序
1) 清理 DevTools 缓存 → 重启 DevTools
2) 重新编译 WeApp：`pnpm -C apps/client build:weapp`
3) 验证首页与 Tab 页面注册（`pages/home/index`）
4) 跑覆盖报告：`node scripts/audit-coverage.mjs`
5) 评估 AI 接口接入（如延期，更新处置清单）
6) 跑契约/覆盖：`pnpm openapi:lint` + `node scripts/audit-openapi-backend.mjs`
7) 更新测试报告：`docs/engineering/test-report.md`

## 开发命令速查
- 启动 mock：`pnpm mock`
- 启动 WeApp：`pnpm -C apps/client dev:weapp`
- 启动 H5：`pnpm -C apps/client dev:h5`
- 启动管理端：`pnpm -C apps/admin-web dev`
- 一键重置：`powershell -File scripts/dev-reset.ps1`

## Mock 与场景切换
- Header：`X-Mock-Scenario: happy|empty|error|edge|payment_callback_replay|order_conflict|refund_failed`
- Query：`?__scenario=happy`（用于临时覆盖）

## 关键环境变量
- `TARO_APP_API_BASE_URL` / `VITE_API_BASE_URL`：前端 API Base URL
- `UPSTREAM_API_BASE_URL`：mock-api 上游 API
- `UPSTREAM_PATH_PREFIXES`：转发路径白名单（见 `apps/mock-api/src/server.js`）
- `DEMO_AUTH_ENABLED`：开发/测试 Demo 登录开关（生产构建会隐藏 Demo 登录入口）

## P0 核心模块（按顺序验证）
1) Files / Upload / Preview
2) Patents / Normalize
3) Listings + Search
4) Messaging
5) Orders / Payments / Refunds / Settlement
