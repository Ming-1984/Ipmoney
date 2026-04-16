# 首页特色专区跳转与样式修复（2026-04-14）

## 背景
- 问题1：首页“特色专区-更多”错误跳转到搜索页，不是专门承接页。
- 问题2：首页 `home-quick` 宫格中“机构”图标为蓝色，风格与其他入口不一致。

## 本次修复
- 新增专门页面：`/subpackages/patent-square/index`（专利广场）。
- 首页“更多”按钮改为跳转“专利广场”。
- “专利广场”展示全部启用的特色专区卡片（不受首页 4/6 显示数限制）。
- 卡片点击动作与首页复用同一套执行逻辑（`SEARCH_PREFILL`/`PAGE_ROUTE`）。
- `home-quick` 的“机构”图标改为统一风格资源 `home-organization.svg`，并同步宫格样式类名为 `organization`。

## 影响范围
- `apps/client/src/pages/home/index.tsx`
- `apps/client/src/pages/home/index.scss`
- `apps/client/src/lib/homeLandingFeatured.ts`
- `apps/client/src/subpackages/patent-square/index.tsx`
- `apps/client/src/subpackages/patent-square/index.scss`
- `apps/client/src/subpackages/patent-square/index.config.ts`
- `apps/client/src/app.config.ts`

## 验收要点
1. 首页“特色专区-更多”进入“专利广场”页面。
2. “专利广场”能展示所有启用的特色卡片。
3. 点击卡片后，搜索预填/页面路由动作与首页卡片保持一致。
4. `home-quick` 中“机构”视觉与其他入口统一，不再出现蓝色突兀风格。
