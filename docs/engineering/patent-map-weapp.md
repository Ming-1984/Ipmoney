# 专利地图（小程序端）能力说明（2026-03-25）

## 1. 当前能力范围
- 首页入口：`pages/home/index` 中提供“专利地图”快捷入口，跳转 `subpackages/patent-map/index`。
- 小程序地图页：
  - 地图点位展示（含区域标签、挂牌数、专利数、排名）。
  - 区域排名列表与明细联动。
  - 数据范围切换：`ACTIVE_APPROVED` / `ALL`。
- 后台批量管理：
  - 管理端“专利批量运营”提供地图聚合、区域明细、批量 patch。
  - API：`POST /admin/patent-map/listings/batch`。

## 2. 数据口径（单一数据源）
- 地图聚合不引入独立冗余表，统一来源：
  - `listings`
  - `regions`
  - `patents`
- 区域归属解析顺序：
  1. `listing.regionCode`
  2. `seller.regionCode`（当 listing 区域缺失时回退）
- `unassignedListingCount` 含义：
  - listing 与 seller 都无法提供有效地区编码时计入。

## 3. 排名规则
- 当前区域排名优先级：
  1. `listingCount`（降序）
  2. `patentCount`（降序）
  3. `activeRankedListingCount`（降序）
  4. `rankedListingCount`（降序）
  5. `topActiveRank`（升序）
  6. `regionCode`（升序）

## 4. API 对齐
- 小程序地图读取：
  - `GET /search/patent-map/overview?regionLevel=PROVINCE&top=100&scope=...`
  - `GET /search/patent-map/regions/{regionCode}?page=1&pageSize=20&scope=...`
- 后台批量写入：
  - `POST /admin/patent-map/listings/batch`
- 公告链路（首页关联）：
  - `GET /public/config/home-announcements`
  - `GET/POST/PUT/DELETE /admin/config/home-announcements*`

## 5. 验收建议
- 页面链路：
  - 首页入口可达地图页。
  - 地图 marker 可见、可点、可联动区域明细。
  - 数据范围切换后 KPI/排名/明细一致刷新。
- 运维链路：
  - 批量 patch 后总览与区域明细同步变化。
  - OpenAPI 与后端路由差异为 0。
  - smoke 覆盖包含专利地图与公告接口。
