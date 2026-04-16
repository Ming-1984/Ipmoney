# 短信签名排障（2026-04-15）

## 现象

- 接口：`POST /auth/sms/send`
- 返回：`400`
- 业务码：`SMS_SEND_FAILED`
- 阿里云上游码：`SignatureDoesNotMatch`

## 已确认

- 本地接口入参校验通过，报错来自阿里云网关。
- 当前 `.env` 已按约定字段配置：
  - `SMS_PROVIDER=ALIYUN`
  - `SMS_ACCESS_KEY=<REDACTED_ACCESS_KEY_ID>`
  - `SMS_SECRET_KEY=<REDACTED_ACCESS_KEY_SECRET>`
  - `SMS_SIGN_NAME=广东聚智诚`
  - `SMS_TEMPLATE_ID=SMS_326726272`
- 直接调用短信客户端时可复现 `SignatureDoesNotMatch`，说明是阿里云签名校验不通过，不是前端传参问题。

## 结论

- 根因优先级最高为：`SMS_SECRET_KEY` 与阿里云 RAM 中该 `AccessKeyId` 不匹配（含复制错位/历史轮换）。
- 次要可能：账号下该 AccessKey 已被禁用或删除后重建，导致本地旧密钥失效。

## 处理建议

1. 在阿里云 RAM 控制台找到 `AccessKeyId=<REDACTED_ACCESS_KEY_ID>`，重新生成一组新 Secret。
2. 将 `.env` 中 `SMS_ACCESS_KEY/SMS_SECRET_KEY` 同步替换为同一组新值（只保留一组，避免混配）。
3. 重启 API 服务后执行：
   - `POST /auth/sms/send` 验证返回 `200`
   - `pnpm check:prod-env` 验证门禁通过

## 补充

- 后端现已在 `SMS_SEND_FAILED` 中透传 `upstreamCode/upstreamMessage/upstreamRequestId`，便于后续直查阿里云工单。
