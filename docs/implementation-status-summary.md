# 实现现状与待办总览（全量）

本文汇总当前前端/后台/后端实现情况与待办，作为统一总览文档；细节对齐记录详见 `docs/alignment-gap-report.md`。

## 0. 范围与结论
- 对齐对象：`apps/client`（小程序/H5）、`apps/admin-web`、`apps/api`
- 结论（当前）：
  - 前端 P0 页面已对齐骨架与需求；少量交互仍为占位/轻交互。
  - 后台 P0 页面基本对齐；审核材料/审计日志已补齐后端支撑（材料来自文件关联，日志来自 audit_logs）。
  - 后端接口 P0 已补齐，少量模块仍为占位（cases/rbac/reports），通知中心已接入审核/认证事件，后续补订单类事件即可。

## 1. 当前实现概览

### 1.1 前端（小程序/H5）已实现（P0）
- 登录/身份选择/认证提交
- 首页/搜索/地图/详情页（专利/需求/成果/书画单页滚动 + Sticky Tab）
- 发布链路（专利/需求/成果/书画）
- 消息/聊天/通知/公告
- 订单/订金/尾款/退款/发票/合同中心（订单列表已改为聚合 Tab：全部/待付款/进行中/退款售后/已结束；角色由入口决定；API 支持 `statusGroup`）
- 我的/收藏/设置/法律/帮助/工具页（IPC/产业集群）
- 技术经理人/机构展示/发明人榜
- 地址管理入口与页面

### 1.2 管理后台（admin-web）已实现（P0）
- 仪表盘、认证审核、内容审核（专利/需求/成果/书画）
- 订单管理（列表 + 详情/里程碑）
- 工单/争议处理（基础页 + 证据上传/SLA 占位）
- 退款/结算/发票、地图数据（含 Excel 导入）、系统配置、技术经理人、评论管理
- 报表导出（基础页）
- 账号权限（RBAC 基础页 + 权限校验/审计占位）
- 上架审核详情抽屉 + 需求/成果/书画审核详情“材料/审计日志”接口已落库支撑

### 1.3 后端（api）已实现接口（P0）
- auth/users/regions/patents/patent-map（含 Excel 导入）/files/config
- listings（后台审核/特色置顶 + 前台创建/更新/提交/下架/公开/搜索/我的）
- orders（创建/列表/详情/支付意图/里程碑/退款/发票/结算放款；列表支持 `statusGroup` 聚合筛选，兼容 `status` 精确筛选优先）
- conversations/messages（会话/消息/已读）
- comments（公开列表/新增/编辑/删除）
- favorites（收藏/取消收藏/收藏列表）
- demands/achievements/artworks（发布/编辑/提交/下架/公开详情/搜索/后台审核）
- announcements/notifications（公开公告/通知）
  - 通知中心已由 /notifications 提供真实数据（内容审核/认证审核事件）
- contracts（合同中心列表/上传已落库；仅卖家可上传合同 PDF；仍需补齐文件权限/审计）
- organizations/tech-managers/inventors（机构/技术经理人/发明人榜）
- addresses（地址管理）
- verification（/me/verification 提交 + /admin/user-verifications 审核）
- cases（工单列表/详情/分配/状态/备注，占位）
- rbac（角色/权限/账号分配 + 权限校验/审计占位）
- reports（报表统计/导出，占位）

### 1.4 当前实现形态说明
- demands/achievements/artworks/favorites 已落库（Prisma），接口保持不变。
- 部分模块仍缺少专表：organizations 依托 user_verifications 统计展示；tech-managers 已新增 profile 表支撑配置与统计。
- announcements/notifications/addresses/comments 已落库（Prisma），接口保持不变。
- inventors 发明人榜已改为基于专利/上架的数据库统计。
- conversations 已改为 contentType/contentId 统一落库（listing/demand/achievement/artwork/tech-manager），不再使用虚拟会话占位。
- 文件下载权限已扩展：合同/发票/公开内容封面与媒体允许关联用户访问；仍需补齐更细粒度审计与证据链路。
- 审核材料已改为基于文件/证据字段聚合；审核日志已改为基于 audit_logs。
- 发票已支持后台上传/替换/删除，订单发票查询无文件时返回 404。
- 需后续按数据库模型做**持久化落库**与权限/文件流转完善。

## 2. 文档层对齐结论（已定稿/仍需执行）

> 说明：以下为已定稿与仍需执行的文档/契约结论；引用详见 `docs/TODO.md`、`docs/todo-demand-achievement.md`、`docs/ui-v2-todo.md`。

- 已定稿：P0 范围与渠道（小程序 + 用户 H5 + 管理后台）、NFR/合规基线、关键业务规则（订金/退款/结算/交付）。
- 已补齐：架构图/流程图/ER/OpenAPI 文档清单与内容。
- 已明确：外部数据源 **P1 预留**，P0 不接入；H5 支付仅引导回小程序。
- 仍需执行（实现层）：OpenAPI 与 ER 对应字段的落库与权限/文件流转实现；UI v2 体系按 `docs/ui-v2-todo.md` 推进。

## 3. 仍需补齐/优化（面向实现）

### 3.1 前端（小程序/H5）
- 地址管理已对接列表/新增/编辑/删除/设默认（与后端 CRUD 对齐）

### 3.2 管理后台（admin-web）
- 审核材料/审计日志已由后端持久化与文件关联支撑（仍可优化材料上传与权限）

### 3.3 后端（api）
  - 少量模块仍为占位（cases/rbac/reports），其余已落库（公告/通知/地址/评论/需求/成果/书画/收藏等）
  - 通知中心已接入内容审核/认证审核事件；合同/发票已支持文件上传/下载与权限，仍需更细粒度审计/水印/临时 URL

## 4. 详细 TODO（按优先级）

### 4.1 P0（必须先完成，进入后端正式开发）
- [ ] **数据模型与落库**：完成核心实体 ER/字段/状态机定稿（用户/认证、专利/需求/成果/书画、订单/支付/退款/结算、消息/通知、收藏/评论/地址）。参考 `docs/TODO.md` §3、`docs/todo-demand-achievement.md` §3
- [ ] **OpenAPI 契约**：补齐所有 P0 接口的字段对齐与枚举统一，形成可审计的接口文档。参考 `docs/TODO.md` §4、§14
- [x] **内存模块落库**：demands/achievements/artworks/favorites/inventors/contracts 已完成；organizations 统计落库使用现有表，tech-managers 已补 profile 表
- [ ] **文件/附件链路**：合同/发票/审核材料已可上传与访问控制；仍需补齐下载留痕、临时 URL、水印与更细粒度权限（含 audit 记录）
- [x] **审核与审计日志**：后台审核材料与审计日志字段/接口/展示已打通（材料来源文件关联，日志来源 audit_logs）
- [ ] **支付与订单**：支付意图与回调、退款/争议、结算放款与发票出具字段落库与状态机一致
- [x] **地址/资料设置打通**：前端资料设置与地址管理完成 CRUD 与校验
- [x] **通知中心真实数据源**：替换占位数据，接入审核/认证事件（订单类事件可后补）

### 4.2 P0（前端对齐/收口）
- [x] **专利发布补充字段结构化**：schema/迁移/接口/fixtures 已补齐（deliverables/expectedCompletion/negotiable/质押/许可现状）；前端如仍用摘要兜底需改用结构化字段
- [x] **H5 支付方案确认**：维持“引导回小程序支付”，不做 H5 内发起支付
- [ ] **字段命名与枚举统一**：status/auditStatus/verificationStatus 等跨端一致

### 4.3 P1（可后置，不阻塞 P0）
- [ ] **后台扩展模块**：CMS、AI 解析复核池、托管监控、告警中心、大数据分析
- [ ] **UI v2 体系落地**：公共能力 + 模板接入（参考 `docs/ui-v2-todo.md`）
- [ ] **阶段二能力**：AI/语音智能体、数据地图/大数据分析

## 5. 参考索引
- 对齐总表：`docs/alignment-gap-report.md`
- 需求文档：`Ipmoney.md`
- TODO 总表：`docs/TODO.md`
- 产学研需求/成果专项：`docs/todo-demand-achievement.md`
- UI v2：`docs/ui-v2-todo.md`
- 骨架图：`docs/demo/pages/*.mmd`
