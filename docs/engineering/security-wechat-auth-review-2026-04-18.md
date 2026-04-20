# 微信登录与安全复查（2026-04-18）

## 范围
- API 鉴权链路（短信登录 / 微信登录 / 会话鉴权）。
- CORS、安全响应头、生产环境 demo 登录开关。
- 线上部署后实测（`api/admin/h5` 三端）。

## 代码修复
1. 修复专利服务残留乱码文案与中文匹配词（不改业务逻辑）：
   - `apps/api/src/modules/patents/patents.service.ts`
2. 修复 Bearer 鉴权错误提示乱码：
   - `apps/api/src/common/guards/bearer-auth.guard.ts`
   - 401 文案统一为 `未登录`。
3. 优化 CORS 拒绝策略，避免未知 Origin 触发 500：
   - `apps/api/src/main.ts`
   - 非白名单 Origin 现在返回 `cb(null, false)`，不再抛异常。

## 本地验证
- `pnpm -C apps/api lint` 通过。
- `pnpm -C apps/api test` 全量通过（97 files / 590 tests）。
- `pnpm -C apps/client lint` + `pnpm -C apps/client typecheck` 通过。

## 线上验收（ECS 实测）
1. 健康检查
   - `https://api.xn--m5rv27f.com/health` -> `200`，`db_ok`、`redis_ok`。
2. CORS
   - `Origin: https://admin.xn--m5rv27f.com` -> `200`，带 `Access-Control-Allow-Origin`。
   - `Origin: https://evil.example.com` -> `200`，不带 `Access-Control-Allow-Origin`（浏览器侧正确阻断）。
3. 未登录会话
   - `GET /auth/session` -> `401`，字节验明确认为 `{"code":"UNAUTHORIZED","message":"未登录"}`。
4. 微信登录
   - 空 code -> `400 BAD_REQUEST`（`code is required`）。
   - 非法 code -> `400 WECHAT_MP_CODE2SESSION_FAILED`（微信上游 40029）。
   - `code=demo`（生产）-> `400 NOT_IMPLEMENTED`（`demo auth disabled`）。
5. 短信登录入参校验
   - 非法手机号 -> `400 BAD_REQUEST`（`invalid phone format`）。
6. 站点
   - `https://admin.xn--m5rv27f.com` -> `200`。
   - `https://xn--m5rv27f.com` -> `200`。

## 部署与产物
- 已使用 `scripts/deploy_sunye_prod.py` 完成 API / 管理后台 / H5 更新部署。
- 小程序发布包（最新）：
  - `apps/client/dist/weapp`
  - `.tmp/deploy/weapp-release-latest.zip`

## 结论
- 微信登录链路与短信登录链路为真实实现，未发现“虚拟占位”路径。
- 生产 demo 登录被禁用，鉴权边界有效。
- CORS、安全头与基础鉴权均达到当前发布要求。
- 首页“高价值低金额”未改动。
