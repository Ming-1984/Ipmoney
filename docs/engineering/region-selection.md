# Region Selection 对齐说明（2026-03-27）

## 目标

- 小程序端所有地区选择统一为同一交互：`Picker mode="region" level="region"`（省/市/区一步弹窗选择）。
- 去除旧的跳页式 `subpackages/region-picker` 选择链路。
- 统一前端地区值处理与缓存，避免页面各自解析事件。

## 当前实现

- 统一服务层：`apps/client/src/lib/regions.ts`
  - `parseRegionPickerSelection(input)`：统一解析 `Picker` 返回值。
  - 返回结构：`{ code, name, level, pathCodes, pathNames }`。
  - 内部自动调用 `cacheRegionNames(...)`，同步地区名称缓存。
- 统一页面交互：
  - `apps/client/src/subpackages/search/index.tsx`
  - `apps/client/src/subpackages/organizations/index.tsx`
  - `apps/client/src/subpackages/publish/patent/index.tsx`
  - `apps/client/src/subpackages/publish/achievement/index.tsx`
  - `apps/client/src/subpackages/onboarding/verification-form/index.tsx`
  - `apps/client/src/subpackages/profile/edit/index.tsx`
  - `apps/client/src/subpackages/addresses/edit/index.tsx`
- 地址展示补齐：`apps/client/src/subpackages/addresses/index.tsx` 使用 `regionDisplayName(...)` 展示名称优先。

## 路由与脚本

- 已从 `apps/client/src/app.config.ts` 移除 `subpackages/region-picker` 页面路由。
- UI 采集/冒烟脚本已移除 `region-picker` 页面项，避免冗余检查。

## 管理后台

- 管理后台地区管理仍使用级联管理方案，不受本次小程序交互统一改造影响。
- 小程序与后台在地区编码层保持一致：均以行政区划 code 作为持久化主键。

## 验收标准

- 全部页面地区选择均为同一弹窗直选体验，不再存在“先点省市县再二次确认跳页”的旧流程。
- 表单提交统一持久化 `regionCode`，展示统一通过 `regionDisplayName(...)` 回显。
- 文档、路由、脚本中不再引用 `subpackages/region-picker`。
