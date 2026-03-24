# 专利地图能力状态说明（已恢复）

## 当前状态
- 2026-03-24 起，专利地图已恢复到当前 P0 交付范围。
- 小程序端已接入页面路由 `subpackages/patent-map/index`，首页快捷入口“专利地图”可直达。
- 后端已提供地图聚合接口：`GET /search/patent-map/overview`、`GET /search/patent-map/regions/{regionCode}`。
- 后台已提供批量管理入口与接口：`POST /admin/patent-map/listings/batch`（专利批量运营页）。

## 数据与流程口径
- 地图统计以 `listings + regions + patents` 为单一数据源，不新增独立地图冗余表。
- 仅统计 `auditStatus=APPROVED` 且 `status=ACTIVE` 的挂牌，口径与线上可见数据一致。
- 运营流程：先看地图总览与区域排名，再下钻区域挂牌明细，最后按挂牌 ID 执行批量更新。

## 同步要求
- OpenAPI、前后端类型检查、API 单测与运营文档必须同版本提交。
