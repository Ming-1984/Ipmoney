# 生产域名与链路对齐（2026-03-22）

## 1. 微信后台域名配置（你已提供）

### request 合法域名
- `https://api.ipmoney.cn`
- `https://ipmoney.cn`

### socket 合法域名
- `wss://api.ipmoney.cn`
- `wss://ipmoney.cn`

### uploadFile 合法域名
- `https://api.ipmoney.cn`
- `https://ipmoney.cn`

### downloadFile 合法域名
- `https://api.ipmoney.cn`
- `https://ipmoney.cn`

## 2. 项目内配置对齐（已完成）

- 小程序 AppID：
  - `apps/project.config.json` 已设置 `wxa053408fad6ab1df`
- 小程序前端 API 地址：
  - 生产构建使用 `TARO_APP_API_BASE_URL`
  - 已验证可用值：`https://api.ipmoney.cn`
- 管理后台 API 地址：
  - 生产构建使用 `VITE_API_BASE_URL`
  - 已验证可用值：`https://api.ipmoney.cn`
- 后端公网基地址：
  - 运行时使用 `BASE_URL`
  - 建议固定：`https://api.ipmoney.cn`

## 3. 本轮实际校验结果

已执行并通过：

1. 小程序生产构建校验（使用生产域名）
   - `DEPLOY_ENV=prod`
   - `DEMO_AUTH_ENABLED=false`
   - `TARO_APP_ENABLE_MOCK_TOOLS=0`
   - `TARO_APP_API_BASE_URL=https://api.ipmoney.cn`
   - `pnpm -C apps/client build:weapp`
2. 管理后台生产构建校验（使用生产域名）
   - `DEPLOY_ENV=prod`
   - `VITE_API_BASE_URL=https://api.ipmoney.cn`
   - `pnpm -C apps/admin-web build`
3. 生产环境变量门禁脚本
   - `node scripts/check-prod-env.mjs`
   - 在 `BASE_URL/TARO_APP_API_BASE_URL/VITE_API_BASE_URL` 均为 `https://api.ipmoney.cn` 时通过

## 4. 支付与登录链路的关键 URL（需你确认）

1. 微信支付回调地址（必须公网可达）：
   - `WX_PAY_NOTIFY_URL=https://api.ipmoney.cn/webhooks/wechatpay/notify`
2. 小程序登录使用：
   - `WX_MP_APPID=wxa053408fad6ab1df`
   - `WX_MP_SECRET=<待提供>`
3. API 对外地址：
   - `BASE_URL=https://api.ipmoney.cn`

## 5. 还需要你提供（最小清单）

1. `WX_MP_SECRET`（与当前 AppID 对应）
2. 微信支付商户参数：
   - `WX_PAY_MCHID`
   - `WX_PAY_MCH_CERT_SERIAL_NO`
   - `WX_PAY_API_V3_KEY`
   - `WX_PAY_MCH_PRIVATE_KEY`（PEM）
   - `WX_PAY_PLATFORM_CERT_SERIAL_NO`
   - `WX_PAY_PLATFORM_CERT` 或 `WX_PAY_PLATFORM_CERTS`
3. 生产 CORS 允许域名（建议至少）：
   - `https://ipmoney.cn`
   - `https://www.ipmoney.cn`（若使用）
   - 管理后台实际访问域名（若不是上述域名）
4. 如启用 WebSocket 实时消息：
   - 后端需确认提供 `wss://api.ipmoney.cn` 对应服务（当前系统主链路尚未强依赖 ws）

## 6. 当前结论

- 你提供的域名配置与当前系统架构匹配。
- 代码侧已能按 `api.ipmoney.cn` 构建并通过生产门禁校验。
- 真实上线前的核心阻塞只剩微信密钥与支付商户参数。
