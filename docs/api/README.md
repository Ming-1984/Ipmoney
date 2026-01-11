# OpenAPI

规范文件：`docs/api/openapi.yaml`

## 预览（Swagger/Redoc）

前置：本机已安装 Node.js（含 `npx`）。

- 本地预览（Redocly）：
  - `npx -y @redocly/cli preview-docs docs/api/openapi.yaml --port 8080`

## Mock（Prism）

- 启动 Mock Server（推荐：支持场景切换 + Prism fallback）：
  - `pnpm mock`（`http://127.0.0.1:4010`）

- 仅启动 Prism（纯契约 Mock）：
  - `npx -y @stoplight/prism-cli mock docs/api/openapi.yaml --port 4011 --cors`

场景化 fixtures（用于“退款失败/回调重放/无数据/权限”等演示与回归）见：`docs/engineering/mocking.md`。

## 校验（可选）

- OpenAPI Lint（Redocly）：
  - `npx -y @redocly/cli lint docs/api/openapi.yaml`
