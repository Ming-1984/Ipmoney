# 专利地图联调验收清单（2026-03-25 刷新）

## 1. 验收目标
- 验证“首页入口 -> 小程序地图页 -> 后台批量管理 -> API 文档”全链路一致。
- 验证地图数据仅来自 `listings + regions + patents`，不引入冗余地图表。
- 验证公告链路（首页展示 + 后台发布）与权限模型一致。

## 2. 前置条件
- 后端版本包含 `patent-map` 与 `home-announcements` 接口。
- 管理员账号具备 `config.manage` 与 `listing.audit`（或等价）权限。
- `regions` 具备有效 6 位编码及省级中心点数据。
- 准备可用样例数据（含 `ACTIVE_APPROVED` 与非 active 数据）。

## 3. 小程序验收（首页 + 地图页）
1. 首页“专利地图”入口可跳转至 `subpackages/patent-map/index`。
2. 首页“平台公告”可展示已发布公告，且点击 linkUrl 可按规则跳转。
3. 地图页可切换 `ACTIVE_APPROVED / ALL`。
4. 地图显示区域 marker、标签、排名信息；点击 marker 可联动区域明细。
5. 排名列表与地图/KPI一致（按最新排序口径）。

## 4. 后台验收（专利地图批量 + 公告管理）
1. 专利批量运营页可加载地图总览、区域详情、分页列表。
2. 批量更新 `regionCode/featured*` 后，地图总览与区域明细同步变化。
3. 首页公告页可完整走通：
   - 模板创建/更新/删除
   - 公告草稿创建/更新
   - 发布/下线
   - 删除
4. 无权限账号访问公告配置/写接口返回 403。

## 5. API 验收
- 地图读取：
  - `GET /search/patent-map/overview`（含 `scope`）
  - `GET /search/patent-map/regions/{regionCode}`（含 `scope`）
- 地图批量：
  - `POST /admin/patent-map/listings/batch`
- 公告：
  - `GET /public/config/home-announcements`
  - `GET/POST/PUT/DELETE /admin/config/home-announcements*`

## 6. 一致性检查
- 同一批挂牌数据在三处一致：
  - 地图总览统计
  - 区域详情统计
  - listing 实体字段（`regionCode`, `featuredLevel`, `featuredRank`, `featuredUntil`）
- OpenAPI 与后端路由差异为 0。
- smoke 覆盖报告对上述接口全部命中。

## 7. 回归建议
- 搜索页地区筛选与地图口径一致。
- 挂牌详情的上榜状态展示与地图明细一致。
- 后台“按专利ID批量上架/导入”流程不受地图改动影响。
