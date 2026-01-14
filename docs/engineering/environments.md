# 环境变量与密钥（建议）

> 目标：把“可运行所需配置”一次性列清，避免开发/联调/上线时反复补洞。所有密钥禁止入库，生产环境建议使用 KMS/Secrets Manager。

## 通用

- `NODE_ENV`：`development` / `test` / `production`
- `PORT`：API 监听端口
- `BASE_URL`：对外服务域名（拼接回调 URL、文件访问 URL 等）
- `UPLOAD_DIR`：本地文件落盘目录（P0 可用；生产建议改为对象存储）

## 前端（本地联调）

- `TARO_APP_API_BASE_URL`：用户端（Taro）API Base URL（默认 `http://127.0.0.1:4010`）
- `VITE_API_BASE_URL`：后台（Vite）API Base URL（默认 `http://127.0.0.1:4010`）
- `CLIENT_H5_PORT`：用户端 H5 DevServer 端口（默认 `5173`；`scripts/demo.ps1` 会自动找可用端口）
- `ADMIN_WEB_PORT`：后台 DevServer 端口（默认 `5174`；`scripts/demo.ps1` 会自动找可用端口）

## Mock API（可选：开发网关）

- `UPSTREAM_API_BASE_URL`：真实 API Base URL（可带 `/v1`）
- `UPSTREAM_PATH_PREFIXES`：需要转发到真实 API 的路由前缀（逗号分隔，如 `/files,/patents`）
- `UPSTREAM_FALLBACK_STATUSES`：哪些 HTTP 状态码触发回落（默认 `404,501`）
- `MOCK_API_PORT`：mock-api 监听端口（默认 `4010`；`scripts/demo.ps1` 会自动找可用端口）
- `MOCK_API_PRISM_PORT`：Prism 端口（默认 `4011`）

## 数据库/缓存

- `DATABASE_URL`：PostgreSQL 连接串
- `REDIS_URL`：Redis 连接串

## JWT/鉴权

- `JWT_SECRET`
- `JWT_EXPIRES_IN_SECONDS`（建议如 7200）
- `JWT_REFRESH_EXPIRES_IN_SECONDS`（可选）

## 微信小程序登录

- `WX_MP_APPID`
- `WX_MP_SECRET`

## 微信支付（v3）

- `WX_PAY_MCHID`
- `WX_PAY_MCH_CERT_SERIAL_NO`
- `WX_PAY_API_V3_KEY`
- `WX_PAY_MCH_PRIVATE_KEY`（建议为 PEM 内容；或用文件路径变量）
- `WX_PAY_PLATFORM_CERTS`（可选：平台证书缓存）
- `WX_PAY_NOTIFY_URL`：支付/退款回调地址（指向 `docs/api/openapi.yaml` 的 webhook path）

## 对象存储（S3 兼容）

- `S3_ENDPOINT`（MinIO/COS/OSS 网关）
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`
- `S3_PUBLIC_BASE_URL`（CDN/公网访问前缀）

## 短信/通知（可选）

- `SMS_PROVIDER`（如 `TENCENT`/`ALIYUN`）
- `SMS_API_KEY` / `SMS_API_SECRET`
- `SMS_SIGN_NAME`
- `SMS_TEMPLATE_ID_LOGIN`

## 运行开关（Feature Flags）

- `ENABLE_USER_H5`：是否开启用户 H5（P0 默认 true）
- `ENABLE_H5_PAYMENT`：是否允许在 H5 发起支付（P0 默认 false；仅展示“去小程序支付”）
- `ENABLE_AUTO_PAYOUT`：是否允许“超时自动放款”（P0 默认 false；建议强制走后台配置）
