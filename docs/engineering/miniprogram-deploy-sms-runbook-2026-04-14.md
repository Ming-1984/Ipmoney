# 小程序部署与短信登录联调清单（2026-04-15 更新）

## 当前结论（本次故障）
- `/auth/sms/send` 的 400 根因是阿里云上游返回 `InvalidAccessKeyId.NotFound`，即生产 `SMS_ACCESS_KEY_ID` 无效。
- 生产环境同时存在 `SMS_SIGN_NAME` 变为 `????` 的编码污染风险。

## 本次改动
1. 后端兼容旧端：`/auth/sms/send` 未传 `purpose` 时默认按 `LOGIN` 处理。
2. 生产配置门禁增强：`scripts/check-prod-env.mjs` 新增校验，`SMS_SIGN_NAME` 若为全 `?` 直接失败。
3. API 契约对齐：`/auth/sms/send` 的 `purpose` 改为可选，并标注默认 `LOGIN`。
4. 小程序 API 错误文案去乱码，统一为可读提示（网络/域名/TLS 等）。

## 上线前必做（短信）
- 在阿里云短信服务确认可用 AK/SK，并替换：
  - `SMS_ACCESS_KEY`（推荐）
  - `SMS_SECRET_KEY`（推荐）
  - （兼容）`SMS_ACCESS_KEY_ID` / `SMS_ACCESS_KEY_SECRET`
- 修正短信签名：
  - `SMS_SIGN_NAME=东聚智诚`（确保 UTF-8 写入，不是 `????`）
- 保持模板：
  - `SMS_TEMPLATE_ID=SMS_326726272`

## 验收命令
1. 配置校验
   - `STAGE=prod node scripts/run-with-env.mjs -- node scripts/check-prod-env.mjs`
2. 认证相关测试
   - `pnpm -C apps/api test -- auth.service.spec.ts`
3. 线上冒烟（成功标准：返回 cooldownSeconds）
   - `POST https://api.xn--m5rv27f.com/auth/sms/send`
   - body: `{"phone":"<手机号>","purpose":"LOGIN"}`
4. 小程序构建包
   - `pnpm -C apps/client build:weapp`

## 风险提醒
- 如果 AK/SK 仍无效，接口依旧会报 `SMS_SEND_FAILED`，但现在可通过错误体快速定位到上游账号问题。
- 生产配置写入建议统一走 UTF-8 文件写入流程，避免中文签名被系统编码替换为 `?`。
