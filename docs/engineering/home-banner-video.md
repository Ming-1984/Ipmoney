# 首页 GIF 替换为后端配置视频方案（小程序 | 对象存储直链）

## 背景与现状
- 首页动图位于 `apps/client/src/pages/home/index.tsx` 的 `HomeBanner`，当前使用 `GifImage` 渲染本地 `promo-certificate.optim3.gif`。
- 已有管理后台配置入口 `GET/PUT /admin/config/banner`，当前仅支持 `imageUrl`。
- 小程序首页存在未登录访问场景，媒体 URL 必须公开可访问。
- **本方案明确采用阿里云对象存储提供媒体文件，不走应用服务中转。**

## 目标
- 将首页 GIF 替换为“短视频循环播放”。
- 视频由管理后台配置，不需要重新发版。
- 未登录用户可访问首页播放。
- 保留稳定的海报图（poster）作为兜底。

## 方案概述（对象存储直链，固定）
1. **对象存储提供公开视频与海报**：由运维上传到阿里云 OSS，并通过媒体域名对外提供 HTTPS 直链访问。
2. **配置中心下发**：扩展 BannerConfig 增加 `mediaType/videoUrl/posterUrl`。
3. **小程序前端渲染**：`HomeBanner` 根据配置渲染 `<Video>`，失败回退 `<Image>`。

## 资产规范（建议）
- **格式**：`mp4`（H.264 + AAC 或无音轨）
- **尺寸**：适配 750px 宽，240rpx 高
- **时长**：6-10 秒，循环自然
- **大小**：优先控制在 2-4MB
- **音频**：静音（自动播放成功率更高）
- **海报**：单独上传 `poster` 图片

## 对象存储资源与上传（公共读 + CDN，推荐）
- **媒体域名**：`https://media.ipmoney.cn`（CDN 域名）
- **资源路径**：`/home/banner/`
- **默认文件名**：
  - `banner.mp4`
  - `banner-poster.png`
- **访问策略（确定）**：
  - Bucket 公共读 + CDN 直链
  - HTTPS 可访问
  - 支持 Range 请求
  - **轻量防盗链**：Referer 白名单包含 `h5.ipmoney.cn`、`admin2.ipmoney.cn`，并允许空 Referer

> 说明：首页 Banner 需要未登录可访问，公共读 + CDN 最稳定；签名 URL 不适合首页常驻播放（易过期、缓存命中低）。

### 上传方式（对象存储）
1. 登录阿里云 OSS 控制台，进入对应 Bucket。
2. 上传视频与海报到：`/home/banner/` 路径。
3. 确保媒体域名已正确绑定并可直接访问：
   - `https://media.ipmoney.cn/home/banner/banner.mp4`
   - `https://media.ipmoney.cn/home/banner/banner-poster.png`

> 对象存储、媒体域名、Referer 白名单与 Range 支持的详细配置见：
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
      "imageUrl": "https://media.ipmoney.cn/home/banner/banner-poster.png",
      "videoUrl": "https://media.ipmoney.cn/home/banner/banner.mp4",
      "posterUrl": "https://media.ipmoney.cn/home/banner/banner-poster.png",
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
- `videoUrl`: 对象存储媒体直链 URL
- `posterUrl`: 视频海报（可复用 imageUrl）
- `videoMeta`: 前端渲染策略（可选）

## 管理后台配置更新（明确）
- 后台入口：`http://admin2.ipmoney.cn/`
- 配置接口：`GET/PUT /admin/config/banner`
- 需更新字段：
  - `mediaType: VIDEO`
  - `videoUrl: https://media.ipmoney.cn/home/banner/banner.mp4`
  - `posterUrl: https://media.ipmoney.cn/home/banner/banner-poster.png`

## 封面策略（确定）
- **封面自行上传**：后台上传封面图到对象存储，获得 `posterUrl`
- 不依赖自动截图/转码；封面与视频同域名，利于缓存与统一管理

## 前端接入（小程序）
- `HomeBanner` 改为读取 `bannerConfig.items` 渲染。
- `mediaType=VIDEO` 时使用 `Video` 组件：
  - `autoplay`, `loop`, `muted`, `controls={false}`, `objectFit="cover"`, `poster`
- 失败兜底：`videoUrl` 为空或加载失败 -> 回退 `Image` + `imageUrl`
- 保留本地 `promo-certificate.png` 为最终兜底

## 交互增强（当前实现）
- Banner 支持左右滑动（两条视频）。
- 点击 Banner 进入全屏预览页：`subpackages/media/video-preview/index`。

## 本地模拟（开发环境，无 URL）
用于无对象存储资源时的演示，**仅开发环境**生效。

- 本地资源：
  - `apps/client/src/assets/home/banner-local-1.mp4`
  - `apps/client/src/assets/home/banner-local-2.mp4`
- 启动前自动下载（临时公开视频）：
  - 脚本：`scripts/download-local-banner.ps1`
  - 环境变量覆盖：
    - `BANNER_VIDEO_URL_1`
    - `BANNER_VIDEO_URL_2`
- 小程序构建拷贝：
  - `apps/client/config/index.ts` 使用 `mini.copy.patterns` 将 mp4 拷贝到 `dist/weapp/assets/home/`
- 小程序运行时拷贝（wxfile）：
  - `apps/client/src/lib/localMedia.ts` 将包内资源拷贝到 `wx.env.USER_DATA_PATH` 并返回 `wxfile://` 路径
- 注意：
  - 小程序 `Video` 的 `poster` 仅支持网络 URL，本地模拟不设置 `poster`，由首帧作为封面。

## 访问策略与白名单
- 视频 URL 必须**公开可访问**（不依赖 token）。
- 小程序后台需添加 `media.ipmoney.cn` 为媒体域名白名单（HTTPS 必须有效）。
- 如启用 Referer 防盗链，需确保配置允许来自业务域名的访问，并允许空 Referer。

## 监控与回滚
- 监控：首屏加载失败率、视频加载失败率、首屏耗时
- 回滚：将 `mediaType` 改回 `IMAGE` 或清空 `videoUrl`

## 实施步骤（明确）
1. 运维侧按 `docs/engineering/aliyun-home-banner-media.md` 配置 OSS、媒体域名、Referer 白名单与 Range 支持。
2. 后端扩展 BannerConfig 结构（增加 `mediaType/videoUrl/posterUrl/videoMeta`）。
3. 前端读取 `/public/config/banner` 并渲染视频。
4. 管理后台更新 Banner 配置。
5. 小程序后台添加 `media.ipmoney.cn` 媒体域名白名单。

## 验收清单
- [ ] 未登录用户首页可正常播放视频
- [ ] 视频自动循环且无控件
- [ ] 视频加载失败可回退到海报
- [ ] Banner 支持左右滑动两条视频
- [ ] 点击 Banner 可进入全屏预览页
- [ ] 开发环境可通过本地视频（wxfile）完成无 URL 演示
- [ ] 运营可通过后台替换视频
- [ ] 配置可回滚为图片模式

## 任务更新（当前）
- [x] 小程序首页读取 `/public/config/banner` 渲染 Banner，失败回退本地素材。
- [x] 视频预览页改为读取同一配置并上下滑动切换。
- [x] 管理后台 Banner 配置增加“上传视频/封面”入口并自动写入 JSON。
- [x] 文档补充公共读 + CDN + 轻量防盗链与封面自行上传策略。
- [ ] **对接内容（1：待完成）**  
  上传接口需要返回**可公开访问的 CDN 直链**（或新增 Banner 专用上传接口返回公链），以满足未登录用户播放：
  - `/files` 当前返回的是鉴权 URL（`/files/{id}`），首页不可直接用；需返回 `https://media.ipmoney.cn/...` 这类直链。
  - 后台上传完成后自动写入 `videoUrl/posterUrl`（使用 CDN 公网 URL）。
  - 确保 OSS Bucket 公共读 + CDN 域名生效（支持 Range 与 Referer 白名单/空 Referer）。




