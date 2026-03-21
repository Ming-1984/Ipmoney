# 首页 GIF 替换为后台上传视频方案（小程序）

## 背景与现状
- 首页动图位于 `apps/client/src/pages/home/index.tsx` 的 `HomeBanner`，当前使用 `GifImage` 渲染本地 `promo-certificate.optim3.gif`。
- 后台已有配置入口 `GET/PUT /admin/config/banner`，配置结构仅支持图片 `imageUrl`（见 `apps/api/src/modules/config/config.service.ts`）。
- 文件上传能力已存在：`POST /files` + `POST /files/:fileId/temporary-access`（`apps/api/src/modules/files`）。

## 目标
- 将首页 GIF 替换为“短视频循环播放”展示区。
- 视频可由后台上传并配置，不需要重新发版。
- 兼容未登录用户访问首页的场景。
- 保留稳定的海报图（poster）作为加载与失败兜底。

## 方案总览（推荐：后台上传 + 配置）
1. **后台上传视频**：运营在管理后台上传视频与封面图。
2. **生成可公开访问的 URL**：通过对象存储/CDN 返回公开视频与封面地址。
3. **配置中心下发**：在 Banner 配置中新增 `mediaType` / `videoUrl` / `posterUrl` 等字段。
4. **小程序前端渲染**：HomeBanner 根据配置渲染 `<Video>`，失败时回退到 `<Image>`。

> 关键点：首页存在“未登录用户”访问，因此视频 URL 必须公开可访问（不能依赖临时 token 或用户鉴权）。

## 详细方案

### 1) 资产规范（建议）
- **格式**：`mp4`（H.264 + AAC 或无音轨）
- **分辨率**：建议 750px 宽（与 rpx 适配），高度 240rpx 对应的实际像素按设计稿导出
- **时长**：6–10 秒，循环不突兀
- **大小**：优先控制在 2–4 MB 以内（越小越稳）
- **音频**：建议无音轨或静音（自动播放成功率更高）
- **封面**：单独上传 `poster` 图片（首帧可用，但不一定稳定）

### 2) 存储与 CDN
- **推荐**：对象存储 + CDN 公网直链（如 COS/OSS/S3 + CDN）
- **原因**：
  - 小程序首页可能在未登录状态访问
  - `POST /files` 存储的文件默认走鉴权下载，不适合公开媒体
- **实现方式**（两种二选一）：
  - **A. 新增「公共媒体上传」接口**：上传后直接写入公开桶，返回 CDN URL
  - **B. 复用 `/files`**：但需要额外实现“公开访问”策略（如新增 `ownerScope=SYSTEM` 并放行下载）

> 推荐 A：更清晰、权限更好控制。

### 3) 配置模型扩展（BannerConfig）
建议扩展后台配置结构（保持向后兼容）：

```json
{
  "items": [
    {
      "id": "banner-hero",
      "title": "首页视频",
      "mediaType": "VIDEO",
      "imageUrl": "https://cdn.example.com/home/banner-poster.png",
      "videoUrl": "https://cdn.example.com/home/banner.mp4",
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
- `mediaType`: `IMAGE | VIDEO`（默认 IMAGE）
- `imageUrl`: 继续作为封面 / 兜底图
- `videoUrl`: 视频 URL（公开可访问）
- `videoMeta`: 前端渲染策略（可选）

### 4) 后台上传流程（运营视角）
1. 进入管理后台配置页（已有 Banner JSON 编辑器）。
2. 使用“上传视频/封面”入口上传媒体，得到 CDN URL。
3. 将 URL 粘贴到 Banner 配置 `videoUrl` / `imageUrl`。
4. 保存配置后，首页无需发版即可生效。

> 这里建议为 admin-web 增加上传控件（后续可实现），但本方案不强制。

### 5) 后端接口设计（建议）
**新增：公共媒体上传接口**
- `POST /admin/media/upload`（仅 admin）
- 入参：`file`（mp4 / png / jpg）
- 返回：`{ url, fileId, mimeType, sizeBytes }`
- 行为：上传到公开桶（或公开前缀），返回 CDN URL

**Banner 配置沿用原接口**
- `GET /admin/config/banner`
- `PUT /admin/config/banner`

### 6) 前端接入（小程序）
- HomeBanner 改为根据 `bannerConfig.items` 渲染。
- `mediaType=VIDEO` 时使用 `Video` 组件：
  - `autoplay`, `loop`, `muted`, `controls={false}`, `objectFit="cover"`, `poster`
- 失败兜底：若 `videoUrl` 为空或加载失败，退回 `Image` + `imageUrl`

> 可保留当前 `promo-certificate.png` 作为默认兜底图，防止配置缺失。

### 7) 鉴权与访问策略
- **首页公共访问** → 视频 URL 必须“公开可访问”。
- 如果使用 `/files/:id`，需要：
  - 允许匿名访问某类文件；或
  - 返回长期有效的 CDN URL（不依赖临时 token）

### 8) 小程序域名与性能
- 需在小程序后台配置视频资源域名为合法下载/媒体域名。
- 建议开启 CDN 缓存与 gzip/范围请求（range）。

### 9) 监控与回滚
- 监控：首屏加载失败率、视频加载失败率、首屏耗时。
- 回滚：在 Banner 配置中将 `mediaType` 改回 `IMAGE`。

## 实施步骤（建议）
1. 后端：新增公共媒体上传接口或公开存储策略。
2. 后台：补一个“上传视频/封面”控件（可选）。
3. 配置：扩展 BannerConfig JSON 结构。
4. 前端：HomeBanner 读取 banner 配置，优先渲染视频。
5. 小程序后台：添加视频域名白名单。

## 验收清单
- [ ] 未登录用户首页可正常播放视频
- [ ] 视频自动循环且无控件
- [ ] 视频加载失败可回退到 poster
- [ ] 运营可通过后台替换视频
- [ ] 配置可回滚为图片模式

---

如需，我可以基于此方案进一步输出：
- 具体 API/DTO 设计
- Admin-Web 上传控件的实现建议
- 前端替换的具体代码改动清单
