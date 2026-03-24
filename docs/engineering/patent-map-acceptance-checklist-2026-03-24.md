# 专利地图联调验收清单（2026-03-24）

## 1. 目标
- 验证首页专利地图入口、小程序地图页、后台批量管理、API 契约四条链路一致。
- 验证地图能力基于 `listings + regions + patents` 单一数据源，不引入冗余数据维护。

## 2. 前置条件
- 后端已部署包含 `patent-map` 模块的版本。
- 管理员账号具备 `listing.audit` 权限。
- `regions` 已维护完整 6 位地区编码与中心点坐标（至少省级）。
- 至少准备 10 条 `APPROVED + ACTIVE` 挂牌数据，且覆盖多个地区。

## 3. 小程序验收（首页 + 地图页）
1. 打开首页，确认快捷入口存在“专利地图”，点击可跳转到 `subpackages/patent-map/index`。
2. 进入地图页后，确认可见指标卡：
   - 专利数
   - 挂牌数
   - 活跃上榜
   - 覆盖区域
3. 在微信小程序环境验证地图组件：
   - 地图可加载
   - 点击 marker 后区域明细切换
4. 验证“区域排名”点击可联动“区域明细”列表。
5. 点击某条明细可跳转挂牌详情页。

## 4. 后台验收（专利地图批量管理）
1. 进入后台“专利批量运营”页，定位“专利地图批量管理”区块。
2. 调整聚合层级（省/市/区县）并加载总览，确认数据刷新。
3. 从区域排名进入某区域挂牌列表，分页切换正常。
4. 在区域挂牌表勾选若干挂牌，并手工补充 1-2 个挂牌 ID，确认目标数量自动去重。
5. 执行以下批量场景并核对返回结果：
   - 仅改 `regionCode`
   - 设置 `featuredLevel + featuredRank + featuredUntil`
   - 执行 `clearRanking=true`
6. 批量后刷新区域总览，确认排名与区域统计发生预期变化。

## 5. API 验收（建议 Postman / curl）
- `GET /search/patent-map/overview?regionLevel=PROVINCE&top=30`
  - 返回 `summary/ranking/regions` 结构完整
  - `ranking` 长度不超过 `top`
- `GET /search/patent-map/regions/{regionCode}?page=1&pageSize=20`
  - 返回 `region/summary/items/page`
  - `regionCode` 非 6 位时应返回 400
- `POST /admin/patent-map/listings/batch`
  - 无权限用户返回 403
  - 无效地区编码返回 400
  - 正常请求返回 `updatedCount/missingListingIds/patchApplied`

## 6. 数据一致性检查
- 对同一批挂牌，校验：
  - 地图总览统计
  - 区域详情统计
  - 挂牌实际字段（`regionCode`, `featured*`）
  三者一致。
- 核对数据库无新增地图冗余业务表，仅为原有主表字段更新。

## 7. 回归建议
- 搜索页按地区筛选结果未受影响。
- 挂牌详情页上榜展示未受影响。
- 后台原有“按专利ID批量上架 / 导入任务”流程未受影响。
