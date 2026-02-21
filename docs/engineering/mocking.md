# Mock 驱动并行开发（OpenAPI + fixtures）

> 目标：前端不等后端，页面交互/状态机先完成；后端上线后只切换数据源。

## 原则
1. OpenAPI 为唯一契约（任何接口改动先改 OpenAPI）。
2. 双层 Mock：契约 Mock + 业务 fixtures Mock。
3. 同一套 fixtures 复用开发/冒烟/演示。

## 启动方式
- Mock API（fixtures + Prism fallback）：
  - `pnpm -C apps/mock-api dev`
- 默认端口：`http://127.0.0.1:4010`

## 场景切换
- Header：`X-Mock-Scenario: happy | empty | error | edge`
- fixtures 未命中的接口会转发到 Prism（内部端口 `4011`），确保契约覆盖。

## 重置 Mock 状态
- 直接调用：`POST http://127.0.0.1:4010/__reset`
- 脚本：`scripts/dev-reset.ps1 -Target mock`

## 环境建议
- Dev：默认接 Mock（便于页面联调与演示）。
- Staging：优先接真实 API，但允许使用 DEMO 开关做灰度验证。
- Prod：禁用所有 DEMO/Mock 开关（见环境变量清单）。

## 常见问题
- 如果需要同时验证契约与后端实现：
  - 前端先接 Mock；后端联调时切换 `API_BASE_URL` 到真实 API。
- 如果出现“数据漂移”：
  - 先更新 OpenAPI，再更新 fixtures 与后端实现。
