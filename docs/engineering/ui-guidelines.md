# UI 指南（Client + Admin）

> 最后更新：2026-02-20

## 范围
- apps/client（微信小程序 + Taro H5）
- apps/admin-web（React + Ant Design）

## 原则
1. Token 驱动：颜色/间距/字号不硬编码，例外走白名单。
2. 状态机统一：permission -> audit -> loading -> error -> empty -> content。
3. 页面模板：A-G（Tab / List / Detail+Sticky / Form / Payment / Chat / Policy）。
4. 权限策略：public / login-required / approved-required（页面级 + 动作级）。
5. 视觉基线：微信/WeUI 风格，清爽、克制、信息密度高。

## 视觉系统
- 主色：#FF6A00；点缀金色 #FFC54D；背景 #FFF3E6；主文本 #0F172A；次级 #475569；边框 #E2E8F0。
- 背景变体：default（渐变 + 轻纹理）、plain（聊天/地图）、strong（P1）。
- 品牌资源：
  - apps/client/src/assets/brand/logo.gif
  - apps/admin-web/src/assets/brand/logo.gif

## 字号与密度
- 基线（rpx）：display 44, hero 40, title 36, body 34, subtitle 28, caption 24。
- 最小可读：24rpx。
- H5 root clamp：base 20, min 18, max 22；text-size-adjust 100%。
- 触控热区 ≥ 44px。

## 导航规范
- 小程序使用原生导航栏；H5 使用 PageHeader/NavBar。
- 统一 safeNavigateBack，避免双导航。

## 筛选/排序收口（摘要）
- 专利检索：q、regionCode、patentType、transactionType、price/deposit 范围、ipc、loc、legalStatus、industryTags；排序 RECOMMENDED/LATEST/PRICE_ASC/PRICE_DESC。
- 需求/成果检索：q、regionCode、预算范围、合作方式、成熟度、industryTags；排序 RECOMMENDED/LATEST。
- 书画检索：q、regionCode、作者、价格/订金；排序 RECOMMENDED/LATEST。
- 机构检索：q、regionCode、types；排序 LATEST。
- 发明人榜：q、regionCode、patentType；排序 RECOMMENDED/LATEST。
- 订单列表：statusGroup/status；默认按最新。
- 产业标签统一使用 `GET /public/industry-tags`（不以自由输入为主路径）。

## QA 检查（P0）
- 用户可见文案不出现 “demo/mock” 等字样。
- 页面状态机完整，无白屏。
- 底部吸附与 TabBar 安全区正确。
- 弹层/滚动不穿透。
- H5 深链可落地（根路径重定向）。
- H5 桌面端 ≥768px 居中手机宽度，固定层对齐。
- 筛选/排序控件统一组件。

## 当前状态
- 已完成：状态机、错误归一化、背景 token、H5 clamp、筛选/排序收口、导航规则、核心模板。
- 待完成：硬编码 token 最终清扫、弹层/滚动回归、H5 桌面密度验证、P1 多地图扩展。

## 相关文档
- Token 映射：docs/engineering/token-mapping.md
- 硬编码白名单：docs/engineering/hardcode-whitelist.md
- 历史规划归档：docs/engineering/archive/legacy-roadmaps-2026-02-to-2026-03.md
