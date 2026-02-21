# Patent Map（小程序）真实地图方案（P0.1）

## 目标与范围
- **目标（最小可用）**：在小程序端真实地图底图上展示“省级专利数量”，支持点击查看区域详情。
- **范围**：仅小程序端（weapp）；仅省级（`PROVINCE`）；**不引入外部地图 Key**；不做省市面填色（choropleth）。
- **复用**：继续复用现有“区域详情页”与 `GET /patent-map/regions/{regionCode}?year=...`。

## 现状
- `pages/patent-map/index` 当前为“年份切换 + 区域列表”。
- 后端已有接口：
  - `GET /patent-map/years`
  - `GET /patent-map/summary`
  - `GET /patent-map/regions/{regionCode}`
- 行政区中心点已入库：`GET /regions?level=PROVINCE` 返回 `centerLat/centerLng`。

## 组件选择（成熟组件）
- 地图：Taro `Map`（小程序原生 map 组件），支持 `markers/label/callout`，无需外部 Key。
- 建议别名：`TaroMap`（避免与全局 `Map` 冲突）。
- 交互：复用 `PageHeader/Surface/CellRow`，地图下方展示选中区域卡片 + “查看详情”入口。

## 实施计划（待对齐）
1) 年份 + summary + 省级中心点 join，生成 markers（缺中心点只展示列表）。
2) 地图渲染 markers，点击 marker 更新“选中区域卡片”。
3) 卡片按钮跳转详情页（复用 `/pages/patent-map/region-detail`）。
4) 可选：使用 `MapContext.includePoints` 适配视野。

## 数据来源（P0.1）
小程序端只需把两个接口结果做一次 join：
1) 年份：`GET /patent-map/years`
2) 省级统计：`GET /patent-map/summary?year=YYYY&level=PROVINCE`
3) 省级中心点：`GET /regions?level=PROVINCE`

Join 规则：
- key：`regionCode`（summary 为 `code`，region 为 `code`）
- 若某省 `centerLat/centerLng` 缺失：不出 marker，但保留列表展示。

## UI 与交互（P0.1）
- 顶部：年份 Segmented（保持现有交互）。
- 地图：使用小程序 `Map` 组件在真实底图上渲染省级 markers。
  - marker 文案：展示 `patentCount`（或在 callout 中展示“省名 + 数量”）。
  - marker 点击：弹出底部卡片，包含 `regionName`、`patentCount`、按钮“查看详情”。
  - “查看详情”：跳转 `pages/patent-map/region-detail/index?regionCode=...&year=...`。
- 列表：保留当前省级列表作为兜底（方便快速进入详情）。

## 技术要点（实现提示）
- marker `id`：建议使用 `Number(regionCode)`（如 `110000`）确保为 number。
- Map 命名冲突：数据结构使用 `globalThis.Map` 或组件别名，避免 `Map is not a constructor`。
- 初始视野：
  - 方案 A（最省事）：固定中国中心点 + scale（如 `lat=35.8617,lng=104.1954`）。
  - 方案 B（体验更好）：markers 生成后用 `includePoints` 自动适配视野（可选）。
- 权限：不展示用户定位（`showLocation=false`），无需额外定位授权。

## 非目标（本轮不做）
- 省/市区下钻（地图层级切换）。
- 省市面填色/热力图。
