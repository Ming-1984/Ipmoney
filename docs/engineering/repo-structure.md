# 仓库结构建议（模块化单体 → 可拆分微服务）

> 目标：P0 用一个可跑通的工程交付，但目录与依赖关系要天然支持未来拆分（参考 `docs/architecture/c4-container.mmd` 的服务边界）。

## 推荐：Monorepo（便于共享类型与规范）

```
docs/
  api/
  architecture/
  engineering/
apps/
  api/              # NestJS API（模块化单体）
  admin-web/        # PC 后台（React）
  client/           # 用户端（Taro：编译小程序 + H5）
  mock-api/         # （可选但推荐）OpenAPI Mock Server（Prism）+ fixtures 场景切换
packages/
  api-types/         # OpenAPI 生成的 TypeScript 类型（单一契约来源）
  shared/           # DTO/枚举/校验规则/工具函数（与 OpenAPI 对齐）
  api-client/       # OpenAPI TS client + 数据源适配（real/mock；前端只替换数据源）
  fixtures/         # 可复用 fixtures（happy/empty/error/edge；用于演示与回归）
```

## 根目录工程文件（建议一次性定稿）

- `pnpm-workspace.yaml`：工作区定义
- `turbo.json`：构建/并行任务编排
- `package.json`：根脚本（lint/format/mock/dev/build）
- `.nvmrc` 或 `package.json#volta`：锁定 Node 版本
- `docker-compose.yml`：本地一键启动 Postgres/Redis/MinIO
- `.env.example`：环境变量清单（与 `docs/engineering/environments.md` 对齐）

## API（apps/api）模块边界（按域）

- `auth/`：登录、token、RBAC
- `user/`：用户资料、认证主体
- `patent/`：号码规范化、专利主数据
- `listing/`：上架、审核状态、资料
- `order/`：订单状态机、幂等校验、退款入口
- `payment/`：微信支付、回调、退款、对账记录
- `case/`：跟单工单、里程碑、证据归档
- `settlement/`：佣金计算、放款台账、结算完成
- `file/`：上传、鉴权下载、（可选）水印
- `notification/`：模板消息/短信/站内通知

## 拆分原则（将来）

- **先按域拆**：Order/Payment/Settlement 优先（资金链路与合规要求高）
- **再按流量拆**：Search、Messaging 等高并发模块
- **数据拆分策略**：先共库分 schema → 再按服务独立库（配合 Outbox/事件总线）
