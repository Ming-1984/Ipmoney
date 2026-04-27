# 技术经理人与成果展示系统化重构执行方案（直发版）

日期：2026-04-22
版本：v1.0（执行中）

## 1. 改造目标
- 完成“技术经理人 + 成果展示”从素材目录到数据库的批量标准化入库。
- 后台实现统一可运营：可检索、可编辑、可上下架、可补录联系方式。
- 会话链路打通：成果咨询统一进入平台会话中心并可分配。
- 发布身份统一：导入与平台发布主体统一显示为 `ipmoney`。
- 保持既有前台关键约束不变：首页“高价值低金额”文案保留，Logo GIF 不改。

## 2. 范围边界
### 2.1 本次纳入
- API 数据模型扩展（Prisma）
- Admin 管理页面（技术经理、成果管理）
- 会话筛选逻辑（平台会话纳入 ACHIEVEMENT）
- 导入脚本与导入报告
- 编译/测试/部署/验收

### 2.2 本次不纳入
- 微信小程序前端视觉重做（仅做接口与数据可用性保障）
- 营销文案策略重写（保持当前确认口径）

## 3. 实施清单（Todo）
- [x] Prisma schema 扩展：技术经理补充字段、成果治理字段
- [x] 生成 SQL migration
- [x] API service 对齐新增字段（tech-managers / achievements）
- [x] 平台会话筛选纳入 ACHIEVEMENT
- [x] 管理后台新增“成果管理”页面与路由
- [x] 管理后台“技术经理管理”页面补录字段能力
- [x] 新增导入脚本（people + 成果）
- [ ] 修复并通过本轮相关测试
- [ ] 执行生产导入并产出报告
- [ ] 构建并部署到阿里云服务器
- [ ] 线上验收（健康检查 + 页面可用性 + 链路验证）

## 4. 验收标准
- 后台可见：`/tech-managers`、`/achievements` 可访问、可编辑、可上下架。
- 会话可见：平台会话列表可检索成果咨询。
- 导入可追溯：存在 `import-report-<batch>.json`，包含总量、成功量、缺图量、未映射量。
- 部署可用：
  - `https://api.xn--m5rv27f.com/health` 返回健康
  - `https://admin.xn--m5rv27f.com` 可打开
  - `https://xn--m5rv27f.com` 可打开

## 5. 回滚预案
- 代码回滚：按当前发布 tag/commit 回滚 API 与前端构建目录。
- 数据回滚：按 `source_batch` 精确删除本批导入成果；技术经理按导入手机号段与审计日志可追溯回退。
- 证书回滚：部署脚本已内置证书备份目录，异常可恢复 `fullchain.pem` / `privkey.pem`。

## 6. 备注
- 技术经理联系方式允许为空，后续由后台持续补录。
- 素材图缺失不阻塞入库，但必须在导入报告中明确统计。

## 7. 2026-04-23 线上复核记录（技术经理人）
- 复核时间：2026-04-23（生产环境）
- 复核口径：`search/tech-managers` 全量分页拉取（pageSize=50，累计 193 条）
- 结果统计：
  - `total = 193`
  - `intro_empty = 0`
  - `intro_placeholder = 0`
  - `intro_meaningful = 193`
  - `rating_count_gt_0 = 1`
  - `rating_count_eq_0 = 192`
- 结论：
  - “介绍信息不显示”不属于接口缺字段问题，接口已返回简介；若个别终端仍显示异常，优先排查终端缓存/旧包。
  - “只有邓有评分”属于当前业务数据现状（仅 1 人录入了有效评分），不是展示逻辑缺陷。

## 8. 2026-04-23 后续对齐改造（已部署）
- 后端：`/admin/tech-managers` 新增缺失数据筛选参数（直连数据库条件，不走前端假筛选）
  - `missingIntro=true|false`
  - `missingContact=true|false`
  - `missingRating=true|false`
- 后台页面：技术经理管理页已重构为规范中文文案，并新增三项“缺失数据”筛选控件。
- 验收要点：
  - 可按“仅缺失评分”快速筛出未维护评分人员。
  - 可按“仅缺失联系方式”快速筛出需补录联系人/电话人员。
  - 列表中评分列对 `ratingCount=0` 显示“暂无评分”，避免误导。
## 9. 2026-04-23 统一批量导入重构（已完成）

### 9.1 背景
- 之前“专利导入”有后台接口闭环，但“技术经理人 + 成果”主要依赖离线脚本，存在字段口径漂移和执行不可追踪风险。

### 9.2 本次落地
- 新增后端统一接口（管理员 + `patent.import` 权限）：
  - `POST /admin/imports/people-achievements/preview`
  - `POST /admin/imports/people-achievements/execute`
- 新增后台页面：`/imports/bulk`（菜单名：`统一批量导入`）
  - 上传技术经理人 Excel
  - 上传成果 Excel
  - 统一参数：`sourceBatch`、`defaultRegionCode`、`ratingPolicy`、`defaultRatingScore`、`defaultRatingCount`
  - 支持“预检 -> 执行”两阶段
  - 输出分组统计与错误抽样明细
- 新增评分策略标准化：
  - `KEEP_EXISTING`：保留已有评分
  - `FILL_MISSING`：仅补齐无评分
  - `FORCE_SET`：全量覆盖评分

### 9.3 统一规则（服务端硬校验）
- 至少上传一个文件（技术经理人/成果二选一或都传）
- 严格校验文件 ID（UUID）与参数格式
- 技术经理人行校验：姓名必填；简介与任职单位至少一项
- 成果行校验：成果名称必填；成果描述必填
- 地区编码智能解析：支持 6 位编码/中文地区名，无法命中时回退默认地区

### 9.4 可追踪性
- 预检审计：`BULK_IMPORT_PREVIEW`
- 执行审计：`BULK_IMPORT_EXECUTE`
- 审计记录写入 `audit_logs`，含输入参数与分组统计

### 9.5 测试与构建结果
- API 测试通过：
  - `bulk-import.controller.spec.ts`
  - `bulk-import.service.spec.ts`
  - `tech-managers.*` 相关套件
- API 类型检查通过：`pnpm -C apps/api typecheck`
- Admin 构建通过：`pnpm -C apps/admin-web build`

### 9.6 风险收敛
- 后续不再推荐直接运行离线导入脚本做生产主流程
- 统一走后台导入中心，确保参数、校验、审计、结果报告一致

## 10. 2026-04-23 统一批量导入接口二次重构（本轮）

### 10.1 新增能力
- 新增历史接口：`GET /admin/imports/people-achievements/history`
  - 支持分页：`page` / `pageSize`
  - 支持动作筛选：`action=PREVIEW|EXECUTE|ALL`
  - 支持操作者筛选：`actorUserId`
- 后台“统一批量导入”页面新增“导入历史”面板（分页 + 动作筛选 + 刷新），可直接查看每次预检/执行统计。

### 10.2 服务端稳定性补强
- 预检与执行均加入幂等保护（基于 `Idempotency-Key` + 请求参数哈希）：
  - 相同 key + 相同 payload：返回已有结果
  - 相同 key + 不同 payload：返回冲突错误
- Excel 模板表头增加基础校验（人表/成果表），避免错模板误导入。
- 导入逻辑统一通过服务端 `parseRequest` 做强约束，清理隐式参数漂移。

### 10.3 测试更新
- 新增/更新测试：
  - `bulk-import.controller.spec.ts`：覆盖历史接口权限与委托调用
  - `bulk-import.service.spec.ts`：覆盖历史列表查询
- 本轮验证通过：
  - `pnpm -C apps/api test -- bulk-import.controller.spec.ts bulk-import.service.spec.ts`
  - `pnpm -C apps/api typecheck`
  - `pnpm -C apps/admin-web build`（携带 `VITE_API_BASE_URL=https://api.xn--m5rv27f.com`）
