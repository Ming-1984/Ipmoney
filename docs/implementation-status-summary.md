# 实现现状与待办总览（全量）

本文汇总当前前端/后台/后端实现情况与待办，作为统一总览文档；细节对齐记录详见 `docs/alignment-gap-report.md`。

## 0. 范围与结论
- 对齐对象：`apps/client`（小程序/H5）、`apps/admin-web`、`apps/api`
- 结论（当前）：
  - 前端 P0 页面已对齐骨架与需求；少量交互仍为占位/轻交互。
  - 后台 P0 页面基本对齐；审核材料/审计日志仍缺后端支撑。
  - 后端接口 P0 已补齐，但多模块仍为内存/占位实现，需进入持久化与权限/文件流转阶段。

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
- 退款/结算/发票、地图数据、系统配置、技术经理人、评论管理
- 报表导出（基础页）
- 账号权限（RBAC 基础页 + 权限校验/审计占位）
- 上架审核详情抽屉 + 需求/成果/书画审核详情“材料/审计日志”占位接口已接入

### 1.3 后端（api）已实现接口（P0）
- auth/users/regions/patents/patent-map/files/config
- listings（后台审核/特色置顶 + 前台创建/更新/提交/下架/公开/搜索/我的）
- orders（创建/列表/详情/支付意图/里程碑/退款/发票/结算放款；列表支持 `statusGroup` 聚合筛选，兼容 `status` 精确筛选优先）
- conversations/messages（会话/消息/已读）
- comments（公开列表/新增/编辑/删除）
- favorites（收藏/取消收藏/收藏列表）
- demands/achievements/artworks（发布/编辑/提交/下架/公开详情/搜索/后台审核）
- announcements/notifications（公开公告/通知）
- contracts（合同中心列表/上传演示：仅卖家可上传合同 PDF；生产需补齐文件权限/落库/审计）
- organizations/tech-managers/inventors（机构/技术经理人/发明人榜）
- addresses（地址管理）
- verification（/me/verification 提交 + /admin/user-verifications 审核）
- cases（工单列表/详情/分配/状态/备注，占位）
- rbac（角色/权限/账号分配 + 权限校验/审计占位）
- reports（报表统计/导出，占位）

### 1.4 当前实现形态说明
- 部分模块为**内存/占位实现**（非持久化），用于前后端联调与流程对齐：
  demands/achievements/artworks、comments、favorites、organizations/tech-managers/inventors、notifications、announcements、contracts、addresses 等。
- 需后续按数据库模型做**持久化落库**与权限/文件流转完善。

## 2. 发现的“文档缺口/需补齐”

> 说明：以下为对齐过程发现仍需补齐或定稿的文档层任务；引用详见 `docs/TODO.md`、`docs/todo-demand-achievement.md`、`docs/ui-v2-todo.md`。

- 渠道与范围定稿：PC 网页范围与交付边界仍需明确（`docs/TODO.md` §1）。
- 数据模型与 ER 定稿：核心交易模型/状态机与落库字段需成文（`docs/TODO.md` §3）。
- OpenAPI 统一规范：契约与字段一致性审计未完成（`docs/TODO.md` §4、§14）。
- 架构图/流程图：对外演示与验收所需图例尚未定稿（`docs/TODO.md` §5、§8）。
- 文件/对象存储规范：合同/发票/材料附件的上传、权限与留存规范未成文（`docs/TODO.md` §7.4、§7.12、§7.13）。
- UI v2 体系文档：P0 公共能力与模板接入需确认后落地（`docs/ui-v2-todo.md`）。

## 3. 仍需补齐/优化（面向实现）

### 3.1 前端（小程序/H5）
- H5 下单支付仍为“引导回小程序”，若需 H5 支付需补充合规方案
- 资料设置/地址管理目前前端为占位或轻交互，需与后端持久化打通

### 3.2 管理后台（admin-web）
- 审核材料/审计日志需后端持久化与文件关联支持

### 3.3 后端（api）
- 内存模块需落库与权限完善（见第 4 节待办）
- 通知中心真实数据来源、合同/发票真实文件上传与权限控制

## 4. 详细 TODO（按优先级）

### 4.1 P0（必须先完成，进入后端正式开发）
- [ ] **数据模型与落库**：完成核心实体 ER/字段/状态机定稿（用户/认证、专利/需求/成果/书画、订单/支付/退款/结算、消息/通知、收藏/评论/地址）。参考 `docs/TODO.md` §3、`docs/todo-demand-achievement.md` §3
- [ ] **OpenAPI 契约**：补齐所有 P0 接口的字段对齐与枚举统一，形成可审计的接口文档。参考 `docs/TODO.md` §4、§14
- [ ] **内存模块落库**：demands/achievements/artworks/comments/favorites/organizations/tech-managers/inventors/addresses/notifications/announcements/contracts 持久化与权限补齐
- [ ] **文件/附件链路**：合同/发票/审核材料/权属证明等文件上传、访问控制、下载留存（含 audit 记录）
- [ ] **审核与审计日志**：后台审核材料与审计日志字段/接口/展示打通
- [ ] **支付与订单**：支付意图与回调、退款/争议、结算放款与发票出具字段落库与状态机一致
- [ ] **地址/资料设置打通**：前端资料设置与地址管理完成 CRUD 与校验
- [ ] **通知中心真实数据源**：替换占位数据，接入业务事件

### 4.2 P0（前端对齐/收口）
- [ ] **专利发布补充字段结构化**：当前“【补充信息】”需映射到正式字段
- [ ] **H5 支付方案确认**：是否需要 H5 支付/合规通道，或维持跳转小程序
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
