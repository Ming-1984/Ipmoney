# Patent Map（小程序）真实地图方案（P0.1）

## 目标与范围

- **目标（最快落地）**：在小程序端的真实地图底图上展示“省级专利数量”，支持点击查看区域详情。
- **范围**：仅小程序端（weapp）；仅省级（`PROVINCE`）；**不引入外部地图 Key**；不做省市面填色（choropleth）。
- **复用**：继续复用现有“地区详情页”与 `GET /patent-map/regions/{regionCode}?year=...`。

## 现状

- `pages/patent-map/index` 当前为“年份切换 + 区域列表”（表格/列表形态）。
- 后端已有统计接口：`GET /patent-map/years`、`GET /patent-map/summary`、`GET /patent-map/regions/{regionCode}`。
- 行政区中心点已入库并可查询：`GET /regions?level=PROVINCE` 返回 `centerLat/centerLng`。

## 组件选择（成熟组件）

- 地图：Taro `Map`（小程序原生 map 组件），支持 `markers/label/callout`，无需外部 Key。
- 注意：Map 组件请使用别名（如 `TaroMap`），避免与全局 `Map` 冲突。
- 交互：复用现有 `PageHeader/Surface/CellRow`，地图下方展示选中区域卡片 + “查看详情”入口。

## 实施计划（待对齐）

1) 年份 + summary + 省级中心点 join，生成 markers（缺中心点只在列表展示）。
2) 地图渲染 markers，点击 marker 更新“选中区域卡片”。
3) 卡片按钮跳转详情页（复用 `/pages/patent-map/region-detail`）。
4) 可选：使用 `MapContext.includePoints` 适配视野。

## 数据来源（P0.1）

小程序端只需要把两个接口结果做一次 join：

1) 年份：`GET /patent-map/years`
2) 省级统计：`GET /patent-map/summary?year=YYYY&level=PROVINCE`
3) 省级中心点：`GET /regions?level=PROVINCE`

Join 规则：
- key：`regionCode`（summary）= `code`（region）
- 若某省 `centerLat/centerLng` 缺失：该省不出 marker，但仍可在下方列表展示（兜底）。

## UI 与交互（P0.1）

- 顶部：年份 Segmented（保持现有交互）。
- 地图：使用小程序 `Map` 组件在真实底图上渲染省级 markers：
  - marker 文案：展示 `patentCount`（或在 callout 中展示“省名 + 数量”）。
  - marker 点击：弹出浮窗/底部卡片，包含 `regionName`、`patentCount`、按钮“查看详情”。
  - “查看详情”：跳转 `pages/patent-map/region-detail/index?regionCode=...&year=...`（复用现有详情页）。
- 列表：保留当前省级列表作为兜底（同时也方便用户快速点选进入详情）。

## 技术要点（实现提示）

- marker `id`：建议使用 `Number(regionCode)`（如 `110000`）确保为 number。
- Map 命名冲突：数据结构使用 `globalThis.Map` 或组件别名，避免 `Map is not a constructor`。
- 初始视野：
  - 方案 A（最省事）：固定中国中心点 + scale（例如 `lat=35.8617,lng=104.1954`）。
  - 方案 B（体验更好）：markers 生成后用 `includePoints` 自动适配视野（可选）。
- 权限：不展示用户定位（`showLocation=false`），无需额外定位授权。

## 非目标（本轮不做）

- 省/市/区下钻（地图层级切换）。
- 区域面填色（polygons）与边界数据拉取。
- 个性化地图样式、路线规划、地理编码等（这些通常会涉及额外 Key/服务）。

## 后续扩展（P1 方向）

- 省/市/区下钻：复用 `GET /patent-map/summary` 的 `level/parentCode` 参数。
- 面填色：需要行政区边界点串（可选：腾讯位置服务行政区划 `get_polygon=2&max_offset=...` 或引入静态 GeoJSON 资产），再用 `polygons` 叠加渲染。

## 验收口径（P0.1）

- 小程序端 `pages/patent-map/index` 首屏出现真实地图底图 + 省级 markers。
- markers 数量与 `/patent-map/summary?level=PROVINCE` 对齐（缺中心点的省除外）。
- 点击 marker 可看到区域名 + 专利数，并可进入地区详情页。
- 不需要新增任何外部 Key/配置即可跑通。
