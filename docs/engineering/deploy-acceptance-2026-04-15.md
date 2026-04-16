# 生产部署与验收记录（2026-04-15）

## 本次执行范围

- 小程序端：首页特色专区、专利广场、首页 8 宫格（机构入口）、筛选联动。
- 管理后台：`首页运营配置` 路由与入口、中文显示一致性、专利年费托管页面中文。
- API：`/public/config/home-landing` 与 `/admin/config/home-landing` 联动验收、短信登录关键用例回归。
- 部署：client / admin / api 构建并发布到阿里云现网。

## 已完成（代码与部署）

1. 首页“特色专区-更多”固定跳转专利广场  
   - 已移除错误兜底到搜索页的逻辑，避免错跳。  
   - 文件：`apps/client/src/pages/home/index.tsx`

2. 小程序请求错误提示中文化（域名/TLS 问题可读）  
   - 将 `url not in domain list / tls / certificate` 统一提示为中文可执行文案。  
   - 文件：`apps/client/src/lib/api.ts`

3. 首页 8 宫格保持固定 8 项，`五星专利` 已替换为 `机构`  
   - 机构入口与技术经理同页不同 Tab（`ORG`）。  
   - 图标资源已统一为 `home-organization.svg`。  
   - 文件：`apps/client/src/pages/home/index.tsx`

4. 专利广场页面可用，承接“更多”入口  
   - 路由：`/subpackages/patent-square/index`  
   - 文件：`apps/client/src/subpackages/patent-square/*`

5. 管理后台“首页运营配置”入口与路由已可用  
   - 路由：`/config/home-landing`  
   - 菜单：`首页运营配置`（需账号具备 `config.manage` 权限）  
   - 文件：`apps/admin-web/src/router.tsx`、`apps/admin-web/src/ui/AppLayout.tsx`

6. 本地构建与关键测试通过  
   - `pnpm -C apps/client build:weapp` ✅  
   - `pnpm -C apps/client build:h5` ✅  
   - `VITE_API_BASE_URL=https://api.xn--m5rv27f.com pnpm -C apps/admin-web build` ✅  
   - `pnpm -C apps/api build` ✅  
   - `pnpm -C apps/api test test/public-config.controller.spec.ts test/config.service.spec.ts test/admin-config.controller.spec.ts test/auth.service.spec.ts` ✅（36 通过）

7. 现网发布完成（阿里云）
   - API：`/opt/sunye/current/apps/api/dist/`（`pm2 restart sunye-api` 已执行）
   - H5：`/www/wwwroot/xn--m5rv27f.com/`
   - Admin：`/www/wwwroot/admin.xn--m5rv27f.com/`
   - WeApp 上传包：`.tmp/weapp-release-2026-04-15-prod.zip`
8. 部署脚本稳定性修复（避免“假成功/假失败”）
   - 修复 Windows 下 `pnpm` 调用失败（显式解析 `pnpm.cmd`）。
   - 修复 API 产物解压路径，确保 `apps/api/dist/main.js` 真正更新。
   - 增加 API 冷启动健康检查重试，避免重启后瞬时探活误报失败。
   - 增加 Admin/H5 静态目录权限修复（`755/644 + chown www:www`），避免 `403`。
   - 文件：`scripts/deploy_sunye_prod.py`

## 线上验收结论（当前）

1. API 健康检查正常（2026-04-15 20:51 CST）  
   - `http://127.0.0.1:3010/health` 返回 `ok:true`  
   - `https://api.xn--m5rv27f.com/health` 返回 `ok:true`
2. Admin/H5 站点可访问（2026-04-15 20:51 CST）  
   - `https://admin.xn--m5rv27f.com` 返回 `HTTP/2 200`  
   - `https://xn--m5rv27f.com` 返回 `HTTP/2 200`
3. 首页配置接口正常  
   - `https://api.xn--m5rv27f.com/public/config/home-landing` 可返回配置。
4. TLS 已切换为新域名证书（2026-04-15 20:51 CST 抽检）  
   - `api.xn--m5rv27f.com` -> `CN=api.xn--m5rv27f.com`  
   - `admin.xn--m5rv27f.com` -> `CN=admin.xn--m5rv27f.com`  
   - `xn--m5rv27f.com` -> `CN=xn--m5rv27f.com`  
   - `notAfter=Jun 29 23:59:59 2026 GMT`
5. 新逻辑已进入线上产物  
   - `"/subpackages/patent-square/index"`  
   - `home-organization`  
   - API 基址 `https://api.xn--m5rv27f.com`

## 微信发布包与构建产物

- 小程序本地构建目录：`apps/client/dist/weapp/`
- 小程序可上传压缩包：`.tmp/weapp-release-2026-04-15-prod.zip`
- 本次部署包（本地）：
  - `.tmp/deploy-client/deploy-client-20260415-020120.zip`
  - `.tmp/deploy-admin/deploy-admin-20260415-020148.zip`
  - `.tmp/deploy-api/deploy-api-20260415-020205.zip`

## 验收建议（给运营/测试）

1. 小程序首页点击“特色专区-更多”，应进入专利广场，不应跳搜索页。
2. 首页 8 宫格“机构”样式与其他入口一致。
3. 后台账号具备 `config.manage` 时，左侧菜单可见“首页运营配置”。
4. 在后台修改 `listingTopicUi` 后，首页/搜索/发布页标签同步变化。
5. 微信开发者工具关闭“忽略合法域名校验”后，确认 request 合法域名与业务域名配置完整。


## 2026-04-15 21:50 (SMS hotfix + redeploy)

### Backend / API
- Added backward compatibility for `/auth/sms/send`: if `purpose` is omitted, backend defaults to `LOGIN`.
- Added production env guard in `scripts/check-prod-env.mjs`: fail fast when `SMS_SIGN_NAME` is corrupted to all `?`.
- OpenAPI updated: `/auth/sms/send` request now marks `purpose` as optional and documents default behavior.

### Frontend
- Rebuilt H5 and WeApp with latest API error-handling bundle.
- Re-deployed H5 (`xn--m5rv27f.com`) and admin (`admin.xn--m5rv27f.com`) static assets.

### ECS Deploy Result
- API health: `https://api.xn--m5rv27f.com/health` -> OK
- Public home landing config: `https://api.xn--m5rv27f.com/public/config/home-landing` -> OK
- Admin/H5 entry: HTTP 200
- TLS cert for API valid: CN=`api.xn--m5rv27f.com`, expiry `2026-06-29`

### SMS Probe Result
- Request body without `purpose` now reaches SMS dispatch path (compatibility works).
- Current production response still fails with:
  - `code=SMS_SEND_FAILED`
  - `message=aliyun sms request failed with status 404`
  - upstream detail previously confirmed as `InvalidAccessKeyId.NotFound`.
- Conclusion: app path is now correct; remaining blocker is invalid Aliyun AK/SK in production.

### Release Artifacts
- WeApp release zip:
  - `.tmp/weapp-release-20260415-214903-prod.zip`
