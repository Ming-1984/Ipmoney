# 项目状态（Ipmoney）

> 最后更新：2026-02-24

## 本阶段口径（2026-02-24）
- 目标：以 dev/staging 演示与联调为主，**不接入真实微信登录/支付/AI**。
- 开发启动：`scripts/start-dev.ps1 -EnableDemoAuth`（仅 dev 使用）。
- 生产相关 gating 项目本阶段暂缓，见“下一阶段生产 gating”。

## 范围（P0）
- 渠道：微信小程序、Taro H5（电脑端可用）、管理后台 Web。
- 主链路：上架 -> 订金 -> 合同确认 -> 尾款 -> 变更完成 -> 结算放款。
- 内容模块：listings、demands、achievements、artworks、专利地图、机构、技术经理人、公告、通知。

## 已完成（基线）
### 客户端（小程序 + H5）
- 登录/身份引导/认证提交；头像与昵称更新。
- 搜索 + 筛选 + 详情（专利/需求/成果/书画）与统一状态机。
- 发布链路（专利/需求/成果/书画）。
- 订单与支付页面（H5 引导回小程序支付）。
- 订单开票申请入口（订单详情）。
- 收藏、消息/聊天、通知、公告。
- 附件临时授权链路（fileId -> 临时 URL -> 预览/下载）。
- 专利地图、机构、发明人榜、技术经理人。
- 地址管理。

### 管理后台
- 仪表盘、用户认证、内容审核、上架审核。
- 订单与里程碑；退款、放款、发票（含下发开票）。
- 地图 CMS（含 Excel 导入）。
- 配置中心（banner/客服/字典/热门搜索/敏感词）。
- 评论、工单/争议、报表导出。
- RBAC（角色/权限/账号绑定）。
- AI 复核、告警、专利维护（基础版）。

### API + 数据
- OpenAPI <-> Controllers 对齐（243/243）；fixtures 覆盖完成。
- OpenAPI 覆盖审计：脚本修复，未使用接口剩 AI P1。
- 核心模块：auth/users/regions/patents/patent-map/files/config/listings/orders/refunds/settlements/invoices。
- 内容模块：demands/achievements/artworks/announcements/notifications/organizations/tech-managers/inventors。
- conversations/messages、comments、favorites、addresses、verification、cases、reports、rbac、ai、alerts、patent-maintenance。
- 幂等保护（下单/支付/退款/发票）；审计日志；文件访问控制；临时 URL 与水印。
- DEMO 特性开关（生产默认关闭）。
- 生产就绪基础项：支持 `TRUST_PROXY`、`CORS_ORIGINS`；access log 默认不记录 query（避免泄露敏感信息）。

### QA / 运营
- DB 预检与备份/恢复 runbook。
- UI 渲染 + HTTP 冒烟 + API 冒烟，结果见测试报告；WeApp 额外提供无截图路由冒烟脚本辅助定位问题（仍需手工冒烟收口）。
- OpenAPI 覆盖报告定期更新（`docs/engineering/openapi-coverage.md`）。

## 进行中 / 待补齐（P0 收口）
- WeApp 手工冒烟（首页/搜索/详情/消息/收藏/个人中心/发布）。
- AI 解析/智能体接口：本轮暂缓（待你确认后再接入）。

## 下一阶段生产 gating（本阶段暂缓）
### 认证与身份
- 真微信登录（code2Session）、真短信通道、真手机号绑定。
- 替换 demo token：JWT + 严格 RBAC（前后台）。

### 支付与资金
- 微信支付预下单与回调验签/解密。
- 微信退款 API + 回调处理。
- 对账任务与报表口径。
- 商户证书/密钥与回调域名白名单。

### 合规与运维
- 生产域名白名单与 TLS 检查。
- 真实登录/支付下跑完整系统测试计划。
- 最终上线检查清单。

### UI/UX 最终检查
- 硬编码 token 清扫（仅保留白名单）。
- H5/WeApp 弹层与滚动回归。
- H5 桌面 ≥768px 密度验证。

## P1 / 可选
- 非 H5 的独立 PC Web（如有需求）。
- 多地图扩展与高级分析。
- AI/告警进一步自动化。

## 关键决策
- H5 支付仅引导回小程序（不做 H5 内支付）。
- DEMO 登录/支付仅用于测试开发；生产默认禁用。
- P0 仅使用平台内数据源，外部数据源为 P1。

## 参考
- Dev QA 清单：docs/engineering/dev-qa-todo.md
- 测试报告：docs/engineering/test-report.md
- 生产过渡 runbook：docs/engineering/production-transition.md
- 权限矩阵：docs/engineering/permissions-matrix.md
- API 契约：docs/api/openapi.yaml
- OpenAPI 覆盖：docs/engineering/openapi-coverage.md
- OpenAPI 未使用接口处置：docs/engineering/openapi-unused-endpoints-decision.md
- 架构索引：docs/architecture/README.md
