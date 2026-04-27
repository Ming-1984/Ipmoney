# 技术经理人与成果批量入库改造（2026-04-22）

## 目标
- 将 `docs/patent/people` 与 `docs/patent/成果` 批量导入平台数据库。
- 导入内容默认以平台身份发布，发布方统一到 `ipmoney`。
- 成果咨询继续走平台会话中心，确保后台可见可分配。
- 导入过程保留治理字段（来源批次、原始状态/分类/地区/机构）便于后续运营校验。

## 数据映射

### 技术经理人（people）
- `姓名` -> 用户昵称 + 技术经理展示名。
- `职位` -> `tech_manager_profiles.position`
- `任职单位` -> `tech_manager_profiles.organization`
- `服务方向` -> `tech_manager_profiles.service_directions_json`（数组）
- `工作亮点` -> `tech_manager_profiles.work_highlights`
- `照片` -> 上传到 `uploads/import-assets/people-avatar/` 并写入 `files`，`users.avatar_url` 指向上传结果。

### 成果（成果列表）
- `成果ID` -> `achievements.external_id`
- `成果名称` -> `achievements.title`
- `成果描述` -> `achievements.description` + `summary(截断)`
- `分类` -> `industry_tags_json` + `source_raw_category`
- `状态` -> `maturity`（规则映射）+ `source_raw_status`
- `地区` -> `region_code`（规则推断）+ `source_raw_region`
- `研究机构` -> `source_org_name`
- `图片路径` -> 封面图上传并写入 `cover_file_id`
- 统一写入：
  - `source=PLATFORM`
  - `audit_status=APPROVED`
  - `status=ACTIVE`
  - `source_batch=people-achievements-2026-04-22`

## 新增脚本
- `scripts/import_patent_people_and_achievements.mjs`

执行方式：
```bash
node scripts/run-with-env.mjs -- node scripts/import_patent_people_and_achievements.mjs
```

可选环境变量：
- `IMPORT_ADMIN_PHONE`（默认 `13925106699`）
- `IMPORT_ADMIN_NICKNAME`（默认 `ipmoney`）
- `IMPORT_ADMIN_USER_ID`（指定发布人用户ID）
- `IMPORT_SOURCE_BATCH`（默认 `people-achievements-2026-04-22`）
- `IMPORT_DEFAULT_REGION_CODE`（默认 `440000`）

脚本产出：
- `docs/engineering/import-report-<batch>.json`

## 风险与治理
- 缺失封面图的数据允许入库，记录在导入报告 `missingCover`。
- 状态/分类无法精准映射时不阻塞入库，写入原始字段并累积 `unmappedStatus` / `unmappedCategory`。
- 技术经理联系方式可为空，后续在后台“技术经理管理”页面补录。

## 接口化升级（2026-04-23）
- 已完成“后台统一批量导入中心”接口化，不再依赖离线脚本作为主流程。
- 后台入口：`/imports/bulk`
- 后端接口：
  - `POST /admin/imports/people-achievements/preview`
  - `POST /admin/imports/people-achievements/execute`
- 执行规范：先预检、后执行；执行结果统一留痕审计。

### 请求参数（统一）
- `peopleFileId`：技术经理人 Excel 文件 ID（可选）
- `achievementsFileId`：成果 Excel 文件 ID（可选）
- `sourceBatch`：导入批次（可选，默认 `people-achievements-manual`）
- `defaultRegionCode`：默认地区编码（可选，默认 `440000`）
- `ratingPolicy`：评分策略（可选，默认 `FILL_MISSING`）
- `defaultRatingScore`：默认评分（可选，默认 `4.8`）
- `defaultRatingCount`：默认评分人数（可选，默认 `16`）

### 评分策略说明
- `KEEP_EXISTING`：不更新已有评分
- `FILL_MISSING`：仅当 `ratingCount <= 0` 时补齐
- `FORCE_SET`：对导入命中对象全量覆盖评分
