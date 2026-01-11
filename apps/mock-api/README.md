# Mock API（Prism）

启动 Mock（fixtures 场景 + Prism fallback）：

- `pnpm dev`

说明：
- 默认端口：`http://127.0.0.1:4010`
- 支持场景切换：Header `X-Mock-Scenario: happy|empty|error|edge`
- fixtures 未命中的接口会转发到 Prism（内部端口 `4011`），保证“契约覆盖度”。
