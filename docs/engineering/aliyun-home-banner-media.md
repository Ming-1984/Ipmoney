提供可匿名访问的视频与海报直链（HTTPS + CDN），用于小程序首页 Banner。

### 有关路径

- CDN 域名：`https://media.ipmoney.cn`（公共读 + CDN 直链）
- 资源路径：`/home/banner/`
- 文件名：`banner.mp4`、`banner-poster.png`
- 轻量防盗链：Referer 白名单 `h5.ipmoney.cn`、`admin2.ipmoney.cn`，并允许空 Referer

## 确认完成

1. `https://media.ipmoney.cn/home/banner/banner.mp4` 可访问（200）。
2. `https://media.ipmoney.cn/home/banner/banner-poster.png` 可访问（200）。
3. 已开启 HTTPS 证书。
4. 已开启 Referer 白名单并允许空 Referer（轻量防盗链）。
5. 已启用 Range 请求支持（视频分段加载）。
6. OSS Bucket 名称与地域。
