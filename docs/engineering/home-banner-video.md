# 首页 GIF 替换为后端配置视频方案（小程序 | ECS 直链）

## 背景与现状
- 首页动图位于 `apps/client/src/pages/home/index.tsx` 的 `HomeBanner`，当前使用 `GifImage` 渲染本地 `promo-certificate.optim3.gif`。
- 已有管理后台配置入口 `GET/PUT /admin/config/banner`，当前仅支持 `imageUrl`。
- 小程序首页存在未登录访问场景，媒体 URL 必须公开可访问。
- **本方案明确采用 ECS 直链，不使用 OSS/CDN 方案。**

## 目标
- 将首页 GIF 替换为“短视频循环播放”。
- 视频由管理后台配置，不需要重新发版。
- 未登录用户可访问首页播放。
- 保留稳定的海报图（poster）作为兜底。

## 方案概述（ECS 直链，固定）
1. **ECS 直链提供公开视频与海报**：由运维在 `h5.ipmoney.cn` 站点目录提供静态文件访问。
2. **配置中心下发**：扩展 BannerConfig 增加 `mediaType/videoUrl/posterUrl`。
3. **小程序前端渲染**：`HomeBanner` 根据配置渲染 `<Video>`，失败回退 `<Image>`。

## 资产规范（建议）
- **格式**：`mp4`（H.264 + AAC 或无音轨）
- **尺寸**：适配 750px 宽，240rpx 高
- **时长**：6–10 秒，循环自然
- **大小**：优先控制在 2–4MB
- **音频**：静音（自动播放成功率更高）
- **海报**：单独上传 `poster` 图片

## ECS 直链资源与上传
- **媒体域名**：`https://h5.ipmoney.cn`
- **媒体目录**：`/home/banner/`
- **文件命名**：建议带日期避免缓存
  - `banner-YYYY-MM-DD.mp4`
  - `banner-YYYY-MM-DD.png`

### 上传方式（ECS）
1. 进入服务器面板 → `h5.ipmoney.cn` 站点根目录。
2. 上传视频与海报到：`/home/banner/`。
3. 确保文件可直接访问：
   - `https://h5.ipmoney.cn/home/banner/banner-YYYY-MM-DD.mp4`
   - `https://h5.ipmoney.cn/home/banner/banner-YYYY-MM-DD.png`

> 服务器侧详细操作与防盗链/Nginx 配置见：
> `docs/engineering/aliyun-home-banner-media.md`

## 配置模型扩展（BannerConfig）
建议扩展后台配置结构（向后兼容）：
```json
{
  "items": [
    {
      "id": "banner-hero",
      "title": "首页视频",
      "mediaType": "VIDEO",
      "imageUrl": "https://h5.ipmoney.cn/home/banner/banner-2026-03-21.png",
      "videoUrl": "https://h5.ipmoney.cn/home/banner/banner-2026-03-21.mp4",
      "posterUrl": "https://h5.ipmoney.cn/home/banner/banner-2026-03-21.png",
      "linkUrl": "",
      "enabled": true,
      "order": 1,
      "videoMeta": {
        "durationMs": 8000,
        "loop": true,
        "muted": true,
        "autoplay": true,
        "objectFit": "cover"
      }
    }
  ]
}
```
字段说明：
- `mediaType`: `IMAGE | VIDEO`（缺省视为 `IMAGE`）
- `imageUrl`: 作为兜底/海报
- `videoUrl`: ECS 直链视频 URL
- `posterUrl`: 视频海报（可复用 imageUrl）
- `videoMeta`: 前端渲染策略（可选）

## 管理后台配置更新（明确）
- 后台入口：`http://admin2.ipmoney.cn/`
- 配置接口：`GET/PUT /admin/config/banner`
- 需更新字段：
  - `mediaType: VIDEO`
  - `videoUrl: https://h5.ipmoney.cn/home/banner/banner-YYYY-MM-DD.mp4`
  - `posterUrl: https://h5.ipmoney.cn/home/banner/banner-YYYY-MM-DD.png`

## 前端接入（小程序）
- `HomeBanner` 改为读取 `bannerConfig.items` 渲染。
- `mediaType=VIDEO` 时使用 `Video` 组件：
  - `autoplay`, `loop`, `muted`, `controls={false}`, `objectFit="cover"`, `poster`
- 失败兜底：`videoUrl` 为空或加载失败 → 回退 `Image` + `imageUrl`
- 保留本地 `promo-certificate.png` 为最终兜底

## 访问策略与白名单
- 视频 URL 必须**公开可访问**（不依赖 token）。
- 小程序后台需添加 `h5.ipmoney.cn` 为媒体域名白名单（HTTPS 必须有效）。

## 监控与回滚
- 监控：首屏加载失败率、视频加载失败率、首屏耗时
- 回滚：将 `mediaType` 改回 `IMAGE` 或清空 `videoUrl`

## 实施步骤（明确）
1. 服务器侧按 `docs/engineering/aliyun-home-banner-media.md` 配置 ECS 直链与防盗链。
2. 后端扩展 BannerConfig 结构（增加 `mediaType/videoUrl/posterUrl/videoMeta`）。
3. 前端读取 `/public/config/banner` 并渲染视频。
4. 管理后台更新 Banner 配置。
5. 小程序后台添加 `h5.ipmoney.cn` 媒体域名白名单。

## 验收清单
- [ ] 未登录用户首页可正常播放视频
- [ ] 视频自动循环且无控件
- [ ] 视频加载失败可回退到海报
- [ ] 运营可通过后台替换视频
- [ ] 配置可回滚为图片模式
