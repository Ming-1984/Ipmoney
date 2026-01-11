# Ipmoney（专利交易平台）

本仓库采用 **Monorepo（pnpm + Turborepo）**，用于并行开发：
- 用户端：`apps/client`（Taro：小程序 + H5）
- 管理后台：`apps/admin-web`（React + AntD）
- Mock：`apps/mock-api`（Prism：基于 `docs/api/openapi.yaml`）
- 后端：`apps/api`（NestJS，P0 先做骨架）

## 快速开始

前置：已安装 Node.js（建议 Node 20 LTS；本地可用 `.nvmrc`）。

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install
pnpm dev
```

默认端口：
- Mock（fixtures + Prism fallback）：`http://127.0.0.1:4010`
- 用户端 H5（Taro）：`http://127.0.0.1:5173`
- 后台（Vite）：`http://127.0.0.1:5174`

Mock 场景切换（演示/回归）：
- Header：`X-Mock-Scenario: happy|empty|error|edge`

## OpenAPI

- Lint：`pnpm openapi:lint`
- 预览：`pnpm openapi:preview`（默认 `http://127.0.0.1:8080`）

## 本地依赖（可选）

```bash
docker compose up -d
```

## 说明

- Mock/fixtures 的规划见：`docs/engineering/mocking.md`
- 甲方演示材料见：`docs/demo/README.md`
