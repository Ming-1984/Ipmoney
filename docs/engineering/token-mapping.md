# Token 映射表（语义 → Client / Admin）

> 目标：把“语义 token”稳定映射到用户端（Taro CSS 变量 / NutUI 主题变量）与后台（AntD ThemeConfig / CSS 变量），避免多端各写一套导致颜色/字号/圆角漂移。

## 1. 色彩（Color）

| 语义 token | 推荐值 | Client（`apps/client/src/app.scss`） | Admin（`apps/admin-web/src/styles.css` / `apps/admin-web/src/main.tsx`） |
|---|---|---|---|
| `Primary` | `#FF6A00` | `--c-primary` | `--ipm-primary` → `theme.token.colorPrimary` |
| `PrimaryHover` | `#FF7A00` | `--c-primary-hover` | `--ipm-primary-hover` |
| `PrimaryActive` | `#E85A00` | `--c-primary-active` | `--ipm-primary-active` |
| `Gold` | `#FFC54D` | `--c-gold` | `--ipm-gold` |
| `BgPage`（`color.bg.page`） | `#FFF3E6`（浅暖） | `--c-bg`（允许更浅） | `--ipm-bg` → `theme.token.colorBgLayout` |
| `BgStrong`（`color.bg.page-strong`） | `#FFE3CC`（更强调） | `--c-bg-strong` | `--ipm-bg-strong` |
| `Text` | `#0F172A` | `--c-text` | `--ipm-text` |
| `Muted` | `#475569` | `--c-muted` | `--ipm-muted` |
| `Border` | `rgba(15,23,42,0.08)`/`#E2E8F0` | `--c-border` | `--ipm-border` |
| `Success` | `#16A34A` | `--c-success` | `--ipm-success` → `theme.token.colorSuccess` |
| `Warning` | `#F59E0B` | `--c-warning` | `--ipm-warning` → `theme.token.colorWarning` |
| `Error` | `#DC2626` | `--c-danger` | `--ipm-error` → `theme.token.colorError` |

## 2. 背景与玻璃态（Background / Glass）

| 语义 token | Client | Admin |
|---|---|---|
| `BgPageGradient`（`bg.page.gradient`｜A） | `--bg-page-gradient` | — |
| `BgPageTexture`（`bg.page.texture`｜C） | `--bg-page-texture` | — |
| `BgPage`（`bg.page`｜A+C） | `--bg-page` | — |
| `BgPagePlain`（`plain`） | `--bg-page-plain` | — |
| `BgContainer`（`color.bg.surface`） | `--c-card` | `--ipm-bg-container` → `theme.token.colorBgContainer` |
| `BgElevated`（`color.bg.surface-elevated`） | `--nutui-color-background-overlay` | `--ipm-bg-elevated` → `theme.token.colorBgElevated` |

> 说明：`BgPage*` 属于“背景合成”token（可承载 `background`/`background-image`），不是单一颜色值；Admin 暂不需要（如后续需要 Login/营销页背景，再补齐映射）。

## 3. 排版（Typography）

| 语义 token | Client（rpx） | Admin（px） |
|---|---|---|
| `Display` | `.text-display` `44rpx` | Title（AntD `Typography.Title`） |
| `Hero` | `.text-hero` `40rpx` |  |
| `Title` | `.text-title` `36rpx` |  |
| `Body` | `.text-body` `34rpx` |  |
| `Subtitle` | `.text-subtitle` `28rpx` |  |
| `Caption` | `.text-caption` `24rpx` |  |

> 说明：用户端遵循 WeUI 常用字号；后台以 AntD 默认排版为基线，保持信息密度与可读性。

## 4. 圆角与阴影（Radius / Shadow）

| 语义 token | Client | Admin |
|---|---|---|
| `RadiusMd` | `--radius-md` / `--nutui-radius-base` | `theme.token.borderRadius` |
| `RadiusLg` | `--radius-xl` | `Card.borderRadiusLG` |
| `ShadowSecondary` | `--shadow-md` | `--ipm-shadow-secondary` → `theme.token.boxShadowSecondary` |
