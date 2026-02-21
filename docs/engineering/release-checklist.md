# 上线前检查清单（P0）

> 目标：在保持“演示/占位”不影响开发的前提下，明确上线必须补齐的检查项。

## 1. 账号与鉴权
- [ ] 微信小程序真实登录接入（code2Session → openid/session_key）
- [ ] JWT + RBAC 落地（移除 `DEMO_USER_TOKEN` 与任意 UUID 直通）
- [x] 生产环境关闭演示开关：`DEMO_AUTH_ENABLED=false`、`DEMO_PAYMENT_ENABLED=false`（能力已落地，生产环境按变量生效）
- [ ] 短信登录真实通道（发送/校验/频控/审计）
- [ ] 手机号绑定真实接入（phonenumber.getPhoneNumber）

## 2. 支付、退款与回调
- [ ] 微信支付真实下单（prepay_id + paySign）
- [ ] 回调验签/解密/金额校验（含重放防护）
- [ ] 退款 API 接入与回调收敛
- [ ] 对账闭环：支付/退款/放款流水导出与异常告警
- [ ] 回调/业务/下载域名白名单配置（下载域名白名单已完成；支付回调域名待真实支付接入后定版）

## 3. 订单主链路（端到端）
- [x] 订金 → 合同确认 → 尾款 → 变更完成 → 结算放款（演示链路 + mock 回归通过）
- [x] 关键状态机与审计日志完整覆盖
- [x] 退款/争议场景的失败兜底与权限校验

## 4. 文件与发票
- [x] 文件权限与下载审计（合同/发票/证据）
- [x] 发票流程完整闭环（申请 → 上传/替换 → 下载）
- [x] 对象存储/临时 URL（如上线采用 S3/MinIO）
- [x] 关键文件水印预览与临时授权访问

## 5. 数据与数据库
- [x] 迁移脚本可回滚、生产备份策略（已提供 `scripts/db-backup.ps1`/`scripts/db-restore.ps1` 与 `docs/engineering/db-backup-restore.md`；enum 变更按备份恢复）
- [ ] 迁移演练：Staging 使用生产快照演练 `prisma migrate deploy`（重点 `20260216190000_schema_alignment`），并做唯一索引冲突预检（见 `docs/engineering/db-preflight-check.md`）
- [x] 关键索引/慢查询基线审计（dev：关键索引存在且 EXPLAIN 命中，见 `docs/engineering/db-preflight-check.md`）
- [x] 数据一致性基线校验（dev：订单/退款/结算/发票预检 0 异常，见 `scripts/db-preflight-check.ps1`）
- [ ] 慢查询生产审计（Staging/Prod：启用 `pg_stat_statements` + 压测/回放）
- [ ] 数据一致性生产回放（Staging：生产快照执行同一套预检 SQL）
- [x] 开发态 DB 预检脚本已落地并执行：`powershell -File scripts/db-preflight-check.ps1 -ReportDate 2026-02-16`（9 项校验 0 失败）

## 6. 安全与合规
- [x] 管理后台高危操作二次确认 + 审计
- [x] 敏感字段脱敏与访问控制
- [x] 访问限流、防刷、风控策略

## 7. 运维与监控
- [x] 健康检查/探针可用（/health）
- [ ] 日志、指标、告警、追踪链路（订单/支付/退款/文件）
- [ ] 灰度与回滚策略

## 8. 前端稳定性
- [ ] 小程序主路径无白屏、无阻塞（真机）
- [ ] 错误态/空态/权限态可恢复
- [ ] 关键页面加载性能可接受（列表/详情/支付结果）

## 9. 测试策略（上线必做）
- [ ] P0 主链路全量功能测试（含失败/边界，按 `docs/engineering/system-test-plan.md` 执行）
- [x] API 契约测试（OpenAPI lint + 关键接口冒烟）
- [x] 回调与幂等回放测试（支付/退款，mock 回放）
- [x] 回归测试（发布、审核、订单、结算、发票，mock 级）
