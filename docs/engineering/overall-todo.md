# Ipmoney 全面检查与上线规划 TODO（当前阶段：不接真实登录/支付/AI）

> Last updated: 2026-02-24
> Scope: apps/client, apps/admin-web, apps/api, ops
> Sources: docs/engineering/project-status.md, docs/engineering/traceability-matrix.md,
> docs/engineering/openapi-coverage.md, docs/engineering/openapi-backend-diff.md,
> docs/engineering/release-checklist.md, docs/engineering/dev-qa-todo.md,
> docs/engineering/payment-chain-audit.md, docs/engineering/weapp-login.md,
> docs/engineering/admin-backend-todo.md, docs/engineering/test-report.md

## 0. 当前结论（基于仓库现状 + 本阶段口径）

- P0 主链路与页面覆盖已收口，OpenAPI 与后端路由对齐，前端调用覆盖良好。
- 本阶段明确：**不接入真实微信登录/支付/AI**，因此相关事项暂缓，不作为当前上线阻断。
- 仍需补齐：配置一致性、demo/mock 治理、WeApp 冒烟、监控与安全、seed 治理、文档/合规、staging 迁移演练。
- 性能现状：WeApp 构建基线稳定；Admin/H5 构建无阻断（已配置合理的 webpack perf budget，H5: asset<=650KiB, entry<=1200KiB；构建不再出现噪声告警；实际包体仍需 P1 持续收敛）。
- 当前开发启动方式：`scripts/start-dev.ps1 -EnableDemoAuth`（Demo Auth/Payment + Demo Token）。
  - 已补齐脚本最佳实践：Demo Payment 独立开关、UUID 直通默认关闭、非 dev 防误用、Mock tools 可显式开启、`PUBLIC_HOST_WHITELIST` 同时覆盖 localhost/127。
  - Windows 兼容：已在 DB 预处理前自动停止 repo 内 `apps/api` 的 node 进程，避免 Prisma query engine DLL 被占用导致 `prisma generate` 失败。
  - 需确保此模式仅用于 dev，staging/prod 强制关闭 Demo 开关。
- 一键自检：`scripts/verify.ps1`（lint/typecheck/build + OpenAPI 审计 + smoke + db preflight）。

## 1. 本阶段 P0 TODO（不接入真实登录/支付/AI）

| ID | 模块 | 任务 | 验收标准 / 产出 | 参考 |
| --- | --- | --- | --- | --- |
| P0-01 | QA | 完成 WeApp 手工冒烟（首页/搜索/详情/消息/收藏/个人中心/发布） | `docs/engineering/test-report.md` 更新记录；清单：`docs/engineering/weapp-manual-smoke-checklist.md`；备注：`scripts/capture-weapp-ui.js`（DevTools 自动化截图）在部分 DevTools 版本上 `screenshot()` 可能超时，仅作为辅助手段；可选：`scripts/weapp-route-smoke.js`（无截图路由冒烟，验证页面可进入且无运行时异常） | docs/engineering/test-report.md, docs/engineering/weapp-manual-smoke-checklist.md, scripts/capture-weapp-ui.js, scripts/weapp-route-smoke.js |
| P0-02 | 配置 | 对齐 docs 与实际默认 API Base（client/admin）（已完成） | 文档与代码默认值一致，生产环境不允许回退 localhost | docs/engineering/admin-backend-todo.md, docs/engineering/environments.md, README.md |
| P0-03 | 开发脚本 | `start-dev.ps1` 最佳实践加固（已完成） | Demo Payment 独立开关、UUID 直通默认关闭、非 dev 防误用、Mock tools 可显式开启、`PUBLIC_HOST_WHITELIST` 覆盖 127/localhost | scripts/start-dev.ps1 |
| P0-04 | 开发流程 | 在文档中明确 `start-dev.ps1 -EnableDemoAuth` 为 dev 标准启动方式（已完成：README + execution-playbook） | README/工程文档更新并注明仅用于 dev | scripts/start-dev.ps1, README.md, docs/engineering/execution-playbook.md |
| P0-05 | Demo/Mock 治理 | Demo 开关与 mock 工具在非 dev 环境全部禁用（已完成：代码侧 + 校验脚本） | `scripts/check-prod-env.mjs` 已覆盖 staging/prod，发现 demo/mock/tokens/localhost 配置会直接失败；服务端 demo auth/payment 在 staging/prod 强制禁用；部署侧需在 staging/prod 启动前运行 `pnpm check:prod-env` | docs/engineering/production-transition.md, apps/client/config/index.ts, apps/admin-web/vite.config.ts, apps/api/src/common/demo.ts, scripts/check-prod-env.mjs |
| P0-06 | 构建安全 | 生产构建阻止注入 demo token（已完成） | 构建期检测 `VITE_DEMO_ADMIN_TOKEN` / `VITE_ENABLE_MOCK_TOOLS`；服务端 demo payment 生产强制关闭 | docs/engineering/admin-backend-todo.md, apps/admin-web/vite.config.ts, apps/api/src/common/demo.ts |
| P0-07 | 监控 | 基础日志/指标/告警落地（不含真实支付）（部分完成） | 已补 requestId header + request access log（JSON line，默认不记录 query/Body，跳过 `/health`，可用 `REQUEST_LOG_ENABLED` 关闭）；外部指标/告警仍待接入 | docs/engineering/production-transition.md, apps/api/src/common/request-id.middleware.ts, apps/api/src/common/request-logger.middleware.ts |
| P0-08 | 数据/Seed | 拆分 seed：基础配置 vs 演示数据（已完成） | 生产不加载 demo seed，dev 可一键回填 | docs/engineering/data-hardcode-inventory.md, apps/api/prisma/seed.js |
| P0-09 | 合规 | 协议页与勾选点位复核（登录页/我的页增加勾选）（已完成） | 登录前强制勾选；协议链接可用；文案后续可替换为正式条款 | docs/legal/*, Ipmoney.md |
| P0-10 | 安全 | 域名白名单/TLS/文件下载域名检查 | `PUBLIC_HOST_WHITELIST` + `BASE_URL` 校验清单；web CORS 白名单（`CORS_ORIGINS`）与反代配置（`TRUST_PROXY`）复核 | docs/engineering/release-checklist.md, docs/engineering/environments.md |
| P0-11 | 文档 | 更新项目状态/发布清单以反映“暂不接真实登录/支付”（已完成） | docs 更新并标注日期 | docs/engineering/project-status.md, release-checklist.md |
| P0-12 | Staging | 迁移预检 + 备份/恢复演练（dev 已完成；staging 仍需生产快照演练） | 本地脚本已通过并记录；staging 使用生产快照完成演练并记录（含 `pnpm -C apps/api db:deploy` + 预检 SQL） | docs/engineering/db-preflight-check.md, docs/engineering/db-backup-restore.md, docs/engineering/test-report.md |
| P0-13 | 合规 | 文案敏感词扫描（已完成） | `pnpm scan:banned-words` 通过并记录在测试报告 | scripts/scan-banned-words.mjs, docs/engineering/test-report.md |

## 2. 本阶段 P1 建议（可并行）

| ID | 模块 | 任务 | 验收标准 / 产出 | 参考 |
| --- | --- | --- | --- | --- |
| P1-01 | 契约 | OpenAPI 与 types 常规更新 | `openapi:lint` + `openapi:types` + 覆盖报告更新 | docs/engineering/openapi-coverage.md |
| P1-02 | 权限 | `ai.manage` 权限补齐或关闭 AI 管理端入口 | 角色权限与后端一致 | docs/engineering/permissions-matrix.md |
| P1-03 | CI/CD | 增加 smoke tests / staging pipeline（部分完成） | CI 已增加 OpenAPI types/审计报告必须同步 + build（h5/weapp/admin/api）；API/UI smoke 仍建议放到可控环境（docker + browser） | docs/engineering/test-report.md, .github/workflows/ci.yml |
| P1-04 | 体验 | H5 ≥768px 与弹层/滚动回归 | H5 桌面无回归 | docs/engineering/project-status.md |
| P1-05 | 性能 | Web 包体与首屏性能收敛（admin + h5） | admin build chunk warning 有阈值（基于 gzip）；h5 build 已设置 perf budget（650KiB/1200KiB）并记录当前包体；后续补充首屏监控与真机数据 | docs/engineering/test-report.md, docs/engineering/dev-qa-todo.md |

## 3. 明确暂缓（后续再开）

| ID | 模块 | 任务 | 备注 |
| --- | --- | --- | --- |
| D-01 | 认证 | 真实微信登录（code2Session） | 暂缓 |
| D-02 | 认证 | 微信手机号授权绑定 | 暂缓 |
| D-03 | 认证 | 真实短信通道 | 暂缓 |
| D-04 | 支付 | 微信支付 v3 JSAPI 预下单 | 暂缓 |
| D-05 | 支付 | 小程序 `requestPayment` | 暂缓 |
| D-06 | 回调 | 支付/退款回调验签与解密 | 暂缓 |
| D-07 | 退款 | 真实退款 API | 暂缓 |
| D-08 | AI | 智能体检索/AI 解析复核 | 暂缓 |

## 4. 决策待定（不阻塞本阶段）

- 本阶段上线目标：仅 dev/staging 演示，还是准备对外发布（不含真实登录/支付）？
- 管理后台登录：继续使用 demo token，还是改为“内部账号密码登录”（不依赖微信）？
