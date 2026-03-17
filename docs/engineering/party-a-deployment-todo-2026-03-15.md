# 甲方部署与联调 TODO（2026-03-15）

> 目标：在已完成本地测试的基础上，形成一套可执行的甲方交付清单。  
> 范围：本清单包含“真实密钥打包交付、甲方补充字段、甲方部署步骤、联调测试项”。  
> 当前状态：待你确认后执行。

## 0. 前置结论（先对齐）

- 支付下单与回调验签/解密链路已接入并通过本地测试。
- 真实登录链路仍为 demo 占位（`wechatMpLogin`/`wechatPhoneBind` 需后续补齐真实实现）。
- 本次按你的要求，交付包中将包含真实密钥，但必须采用加密包与分渠道传递密码。

## 1. 我方待执行：交付包制作（含真实密钥）

- [x] 建立交付目录 `release/party-a-2026-03-15/`
- [x] 输出后端可部署制品（源码包或镜像信息 + 版本号）
- [x] 附带部署文档、环境变量模板、联调测试清单
- [x] 打包真实密钥文件（来自本地 `secret/`，不入 git）
- [x] 生成 `SHA256SUMS.txt`（交付包完整性校验）
- [x] 使用 AES-256 加密压缩包（例如 `7z -mhe=on -p`）
- [x] 通过独立渠道发送解压密码（不与压缩包同渠道）【密码文件已落盘，待人工分渠道发送】
- [ ] 交付后安排密钥轮换窗口（生产上线后可选但建议执行）

## 2. 交付包文件清单（计划）

### 2.1 代码与文档

- [x] `apps/api/`（后端代码）
- [x] `docs/engineering/production-transition.md`
- [x] `docs/engineering/environments.md`
- [x] `docs/engineering/release-checklist.md`
- [x] `docs/engineering/db-preflight-check.md`
- [x] `docs/api/openapi.yaml`
- [x] `README.md`（项目启动与基础说明）

### 2.2 真实密钥与支付资料（按你的要求纳入交付包）

- [x] `secret/apiclient_key.pem`
- [x] `secret/apiclient_cert.pem`
- [x] `secret/apiclient_cert.p12`
- [x] `secret/登陆支付字段.xlsx`
- [x] `secret/证书使用说明.txt`

### 2.3 环境模板（交付时另附）

- [x] `env.prod.template`（基于 `.env.example`，按“已提供/待甲方补充”标注）

## 3. 甲方需补充字段清单（必须）

### 3.1 基础与安全

- [ ] `NODE_ENV=production`
- [ ] `BASE_URL`（公网 HTTPS）
- [ ] `PUBLIC_HOST_WHITELIST`（公网域名）
- [ ] `CORS_ORIGINS`（前端来源白名单，避免 `*`）
- [ ] `JWT_SECRET`（生产强密钥）
- [ ] `FILE_TEMP_TOKEN_SECRET`（生产强密钥，非 `change-me`）
- [ ] `TRUST_PROXY=true`（如有网关/反向代理）

### 3.2 数据库与缓存

- [ ] `DATABASE_URL`（PostgreSQL 生产连接串）
- [ ] `REDIS_URL`（可选，建议提供）

### 3.3 微信支付

- [ ] `WX_PAY_NOTIFY_URL`（必须，公网 HTTPS，指向 `/webhooks/wechatpay/notify`）
- [ ] `WX_PAY_PLATFORM_CERT` 或 `WX_PAY_PLATFORM_CERTS`（建议）
- [ ] `WX_PAY_PLATFORM_CERT_SERIAL_NO`（单证书模式建议）

### 3.4 对象存储（生产建议必须）

- [ ] `S3_ENDPOINT`
- [ ] `S3_REGION`
- [ ] `S3_ACCESS_KEY_ID`
- [ ] `S3_SECRET_ACCESS_KEY`
- [ ] `S3_BUCKET`
- [ ] `S3_PUBLIC_BASE_URL`

## 4. 我方已掌握字段（可直接预填到模板）

- [x] `WX_MP_APPID`
- [x] `WX_MP_SECRET`
- [x] `WX_PAY_MCHID`
- [x] `WX_PAY_API_V3_KEY`
- [x] `WX_PAY_MCH_PRIVATE_KEY`（可由 `apiclient_key.pem` 提供）
- [x] `WX_PAY_MCH_CERT_SERIAL_NO`（可由 `apiclient_cert.pem` 解析）

## 5. 甲方服务器部署 TODO（执行方：甲方，我方远程配合）

- [ ] 准备服务器与公网域名（TLS 证书就绪）
- [ ] 准备 PostgreSQL 实例并创建业务库
- [ ] 准备对象存储 bucket 与访问密钥
- [ ] 注入生产环境变量（不落库到代码仓）
- [ ] 执行数据库迁移：`pnpm -C apps/api db:deploy`
- [ ] 执行初始化数据（仅基础数据，禁用 demo 数据）
- [ ] 启动 API 服务并接入反向代理
- [ ] 配置微信商户平台支付回调地址
- [ ] 验证健康检查接口 `/health`

## 6. 联调测试 TODO（甲方环境）

### 6.1 冒烟

- [ ] `GET /health` 返回 `ok=true`
- [ ] 文件上传/下载链路可用
- [ ] 基础鉴权接口可用（按当前实现验证）

### 6.2 支付主链路

- [ ] 创建支付意图（DEPOSIT）
- [ ] 小程序端拉起支付并完成支付
- [ ] 微信回调可达且验签通过
- [ ] 订单状态更新到 `DEPOSIT_PAID`
- [ ] 创建尾款支付意图（FINAL）并完成
- [ ] 订单状态更新到 `FINAL_PAID_ESCROW`

### 6.3 异常与幂等

- [ ] 重复回调不重复入账（幂等验证）
- [ ] 非法签名回调被拒绝
- [ ] 金额异常回调不通过业务校验

## 7. 上线闸门（Go/No-Go）

- [ ] 甲方必填字段全部到位
- [ ] Staging 全链路用例通过并留痕
- [ ] 发布/回滚方案明确（含数据库备份）
- [ ] 关键密钥保管人与轮换策略确认
- [ ] 双方签字确认交付版本与验收结果

## 8. 待确认后执行的事项

- [x] 你确认本清单后，我执行“交付包制作 + 模板预填 + 打包清单输出”
- [ ] 你确认是否同时推进“真实微信登录链路”补齐计划（建议并行）

## 9. 本次已产出文件（2026-03-15）

- 全栈交付目录（后端 + 用户端 + 管理后台）：`release/party-a-2026-03-15-v3-fullstack/`
- 全栈加密包（最终）：`release/party-a-2026-03-15-v3-fullstack-secure-20260315-162423.7z`
- 全栈密码文件（独立传递）：`.tmp/party-a-2026-03-15-v3-fullstack-password.txt`
- 全栈校验文件：`release/party-a-2026-03-15-v3-fullstack/manifests/SHA256SUMS.txt`
- 后端单体包（留档，可选）：`release/party-a-2026-03-15-v2/`
