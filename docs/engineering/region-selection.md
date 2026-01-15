# Region Selection 升级方案（P0.2）

## 目标

- 支持省/市/区全量选择（6 位 adcode），可停留在任意层级提交。
- 统一小程序端区域选择体验，减少手输 regionCode。
- 管理端地图 CMS 使用级联组件，降低输入错误。

## 现状

- 小程序 `pages/region-picker` 仅 PROVINCE 列表 + 搜索。
- 多处表单仍允许手填 regionCode（发布/资料/筛选页）。
- 管理端 `PatentMapPage` 通过 Input 手输 regionCode。
- 后端 RegionsService 已支持 `q` 过滤，但 public controller 未透传。

## 方案（成熟组件）

- 小程序：Taro `Picker`（`mode="region"`，使用内置行政区数据）。
  - 提供层级切换（省/市/区），由 `level` 控制：`province` / `city` / `region`。
  - 选中后返回 `{ code, name, level, pathCodes, pathNames }`，其中 `code/name` 为当前层级最后节点。
- 管理端：Ant Design `Cascader`（`loadData` 动态加载）。
  - 支持省/市/区选择，默认显示名称 + code。

## 数据与接口

- 小程序端区域选择不再依赖 `/regions`，使用系统内置区域库。
- `/regions` 继续用于地图中心点与后台管理场景。

## 影响范围

- `apps/client/src/pages/region-picker/index.tsx`
- 小程序使用 region picker 的页面（search/inventors/organizations/profile/edit/onboarding/publish 等）。
- `apps/admin-web/src/views/PatentMapPage.tsx`
- 可选：`apps/api/src/modules/regions/regions.controller.ts`

## 验收口径

- 省/市/区任意层级均可选择并返回对应 6 位 code，名称展示正确。
- 现有页面入口统一使用新的 region picker，不需要手输 code。
- 管理端地图 CMS 不再手输 regionCode。
