# 小程序“我的页”协议与待确认项对齐清单（给甲方）

更新时间：2026-03-10
范围：`apps/client`（小程序端）+ `docs/legal`（协议文档）+ `apps/api`（规则配置/流程）

## 1. 协议是否齐全（先给结论）

结论：**按需求文档定义的 9 份协议/规则，文件已齐全（都存在）**；但其中大部分是 **P0 占位/简化稿**，仍需甲方法务/财务给正式版内容。

需求基准（9 份）见：`Ipmoney.md:426-436`

## 2. 所有简化/占位协议文件名（请甲方重点补齐）

1. `docs/legal/user-agreement.md`（P0 口径，占位，待法务确认）
2. `docs/legal/privacy-policy.md`（P0 口径，占位，待法务确认）
3. `docs/legal/trade-intermediary-service-agreement.md`（P0 口径，占位，待法务确认）
4. `docs/legal/deposit-refund-rules.md`（P0 口径，占位，待法务确认）
5. `docs/legal/trade-settlement-rules.md`（P0 口径，占位，待法务确认）
6. `docs/legal/seller-ownership-commitment.md`（P0 口径，占位，待法务确认）
7. `docs/legal/dispute-evidence-rules.md`（P0 口径，占位，待法务确认）
8. `docs/legal/content-reporting-rules.md`（P0 口径，占位，待法务确认）
9. `docs/legal/invoice-tax.md`（P0 口径，需财务/法务确认）

说明：总清单与“占位稿”说明见 `docs/legal/README.md:3-13`。

## 3. 上述其他“简化”或“需甲方确认”的事项（Neritic 对齐项）

### 3.1 小程序协议页面仍是简版文案，不是正式全文协议

1. `apps/client/src/subpackages/legal/terms/index.tsx`：仅 3 段（服务协议/交易规则/违规处理）
2. `apps/client/src/subpackages/legal/privacy/index.tsx`：仅 3 段（隐私政策/信息收集与使用/信息共享）

这两页当前是前端简化展示，需甲方确认是否替换为法务正式长文本（或 H5 协议页）。

### 3.2 协议勾选触点未完全覆盖需求文档

当前已实现：

1. 登录前勾选《用户协议》《隐私政策》
2. 证据：`apps/client/src/subpackages/login/index.tsx:70,308-314`；`apps/client/src/pages/me/index.tsx:144,531-537`

与需求差异（待甲方确认是否必须补齐）：

1. 订金支付前应勾选《专利交易居间服务协议》《订金支付与退款规则》（需求写明，当前支付页未检索到勾选文案）
2. 尾款支付前应再次展示《交易与结算规则》（需求写明，当前支付页未检索到勾选文案）
3. 卖家上架审核前应勾选《卖家上架与权属承诺》（需求写明，当前主要是“上传权属材料”）
4. 需求依据：`Ipmoney.md:440-443`

### 3.3 协议同意留痕机制待确认（版本号/时间戳/入口）

需求写明应记录“版本号 + 时间戳 + 入口”并写审计日志：`Ipmoney.md:447`

当前代码检索未发现专门的“协议同意记录”模型或接口（需甲方确认是否作为 P0 必做）。

### 3.4 发票流程存在口径差异（需甲方拍板）

文档口径（法务/财务说明）：

1. `docs/legal/invoice-tax.md:20` 写明：P0 不做“开票申请 + 状态流转”，线下收集抬头税号

当前前端实现：

1. 订单详情存在“申请开票”动作：`apps/client/src/subpackages/orders/detail/index.tsx:200,447`
2. 同时又写“发票由平台财务线下开具”：`apps/client/src/subpackages/orders/detail/index.tsx:462`、`apps/client/src/subpackages/invoices/index.tsx:112`

需甲方确认最终口径：

1. 方案 A：保留线上“申请开票”
2. 方案 B：彻底线下（移除申请按钮）

### 3.5 交易规则参数虽可配，但“默认值”需甲方书面确认

当前默认（后端）：

1. 订金比例 `5%`，订金区间 `¥100 ~ ¥5000`，面议订金 `¥200`
2. 自动退款窗口 `30 分钟`
3. 补材料时限 `3 工作日`，签约时限 `10 工作日`，权属变更 SLA `90 天`
4. 佣金比例 `5%`，佣金区间 `¥1000 ~ ¥50000`（卖家承担）
5. 放款条件 `TRANSFER_COMPLETED_CONFIRMED`，默认放款方式 `MANUAL`，自动放款 `false`

依据：`apps/api/src/modules/config/config.service.ts:136-151`

### 3.6 后台“交易规则保存”里有两项被固定写死（需甲方确认）

当前保存时固定提交：

1. `payoutCondition: 'TRANSFER_COMPLETED_CONFIRMED'`
2. `payoutMethodDefault: 'MANUAL'`

依据：`apps/admin-web/src/views/ConfigPage.tsx:274-275`

如甲方后续需要改为“可配置微信放款/其他放款条件”，需单独改后台表单与接口策略。

## 4. 甲方本次需明确回复的清单（建议一次性回传）

1. 9 份协议是否都由甲方法务提供正式版本（含版本号、生效日期、更新机制）？
2. 小程序 `terms/privacy` 页面是否改成正式全文（或跳 H5 协议中心）？
3. 是否按需求补齐支付前/上架前协议勾选？
4. 是否要求落地“协议同意留痕”（版本号、时间戳、入口、用户、订单）？
5. 发票流程最终口径：线上申请 or 纯线下？
6. 交易规则默认值是否正式确认（尤其订金、佣金、退款窗口、放款方式）？
7. 放款方式是否保持 `MANUAL`，是否开放后台可切换？

---

附：协议文件齐全性核对结果（文件存在）已完成；本清单重点是“内容正式化”和“流程口径拍板”。
